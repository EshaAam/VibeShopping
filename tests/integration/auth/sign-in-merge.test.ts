/**
 * Signing in hands the guest cart and wishlist from this browser to the
 * account, through the real Auth.js jwt callback and a real transaction. The
 * cart cookie outlives sign-out, so on a shared browser it can point at
 * someone else's cart - that one must never change hands.
 */
import { describe, expect, it } from 'vitest';
import { config } from '@/auth';
import { prisma, setupTestDatabase } from '../helpers/db';
import { lineFor, makeCart, makeProduct, makeUser } from '../helpers/factories';
import { as, guest } from '../helpers/request';

setupTestDatabase();

type Jwt = (args: Record<string, unknown>) => Promise<Record<string, unknown>>;
const jwt = config.callbacks.jwt as Jwt;

/** Sign `user` in on a browser carrying these guest cookies. */
function signIn(user: { id: string; name: string; email: string; role: string }, cartId: string, wishlistId = 'no-wishlist') {
  return as(guest(cartId, wishlistId), () =>
    jwt({ token: {}, user: { id: user.id, name: user.name, email: user.email, role: user.role }, trigger: 'signIn' })
  );
}

const cartsOf = (userId: string) => prisma.cart.findMany({ where: { userId } });
const productIds = (cart: { items: unknown }) =>
  (cart.items as { productId: string }[]).map((i) => i.productId);

describe('cart', () => {
  it('MRG-01: the guest cart replaces the account’s old cart, in one transaction', async () => {
    const user = await makeUser();
    const [old, picked] = [await makeProduct(), await makeProduct()];
    await makeCart({ userId: user.id, sessionCartId: 'other-device' }, [lineFor(old)]);
    const guestCart = await makeCart({ sessionCartId: 'browser-1' }, [lineFor(picked)]);

    await signIn(user, 'browser-1');

    const carts = await cartsOf(user.id);
    expect(carts).toHaveLength(1);
    expect(carts[0].id).toBe(guestCart.id);
    expect(productIds(carts[0])).toEqual([picked.id]);
  });

  it('MRG-02: signing in again on the same browser keeps the cart', async () => {
    const user = await makeUser();
    const picked = await makeProduct();
    const guestCart = await makeCart({ sessionCartId: 'browser-1' }, [lineFor(picked)]);

    await signIn(user, 'browser-1');
    await signIn(user, 'browser-1');

    const carts = await cartsOf(user.id);
    expect(carts.map((c) => c.id)).toEqual([guestCart.id]);
    expect(productIds(carts[0])).toEqual([picked.id]);
  });

  it("MRG-03: on a shared browser, the next person does not take the previous person's cart", async () => {
    const alice = await makeUser();
    const bob = await makeUser();
    const [alicesItem, bobsItem] = [await makeProduct(), await makeProduct()];
    const alicesCart = await makeCart({ userId: alice.id, sessionCartId: 'shared-pc' }, [lineFor(alicesItem)]);
    const bobsCart = await makeCart({ userId: bob.id, sessionCartId: 'bobs-phone' }, [lineFor(bobsItem)]);

    await signIn(bob, 'shared-pc');

    expect((await cartsOf(alice.id)).map((c) => c.id)).toEqual([alicesCart.id]);
    expect((await cartsOf(bob.id)).map((c) => c.id)).toEqual([bobsCart.id]);
  });

  it('MRG-05: if the hand-over fails halfway, the account keeps its old cart', async () => {
    const user = await makeUser();
    const [old, picked] = [await makeProduct(), await makeProduct()];
    const oldCart = await makeCart({ userId: user.id, sessionCartId: 'other-device' }, [lineFor(old)]);
    await makeCart({ sessionCartId: 'browser-1' }, [lineFor(picked)]);

    // Make the second statement (claiming the guest cart) fail in the database
    await prisma.$executeRawUnsafe(`
      CREATE FUNCTION fail_cart_claim() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'simulated failure'; END; $$`);
    await prisma.$executeRawUnsafe(
      `CREATE TRIGGER fail_cart_claim BEFORE UPDATE ON "Cart" FOR EACH ROW EXECUTE FUNCTION fail_cart_claim()`
    );
    try {
      await expect(signIn(user, 'browser-1')).rejects.toThrow(/simulated failure/);
    } finally {
      await prisma.$executeRawUnsafe('DROP TRIGGER fail_cart_claim ON "Cart"');
      await prisma.$executeRawUnsafe('DROP FUNCTION fail_cart_claim()');
    }

    // The delete of the old cart rolled back with the failed claim
    expect((await cartsOf(user.id)).map((c) => c.id)).toEqual([oldCart.id]);
    expect(await prisma.cart.count({ where: { sessionCartId: 'browser-1', userId: null } })).toBe(1);
  });
});

describe('wishlist', () => {
  const makeWishlist = (owner: { userId?: string; sessionWishlistId: string }, productId: string) =>
    prisma.wishlist.create({
      data: {
        userId: owner.userId ?? null,
        sessionWishlistId: owner.sessionWishlistId,
        items: [{ productId, name: 'x', slug: 'x', image: '/x.jpg', price: '1.00' }],
      },
    });
  const wishlistsOf = (userId: string) => prisma.wishlist.findMany({ where: { userId } });

  it('MRG-04: the guest wishlist replaces the old one', async () => {
    const user = await makeUser();
    await makeWishlist({ userId: user.id, sessionWishlistId: 'other-device' }, 'old');
    const guestList = await makeWishlist({ sessionWishlistId: 'browser-w' }, 'picked');

    await signIn(user, 'no-cart', 'browser-w');

    expect((await wishlistsOf(user.id)).map((w) => w.id)).toEqual([guestList.id]);
  });

  it("MRG-04: on a shared browser, the next person does not take the previous person's wishlist", async () => {
    const alice = await makeUser();
    const bob = await makeUser();
    const alicesList = await makeWishlist({ userId: alice.id, sessionWishlistId: 'shared-pc' }, 'a');

    await signIn(bob, 'no-cart', 'shared-pc');

    expect((await wishlistsOf(alice.id)).map((w) => w.id)).toEqual([alicesList.id]);
    expect(await wishlistsOf(bob.id)).toEqual([]);
  });
});

describe('display name', () => {
  it('AUT-11: a No_Name account is renamed after its email, in the database', async () => {
    const user = await makeUser({ name: 'No_Name', email: 'sam.lee@test.io' });

    const token = await signIn(user, 'no-cart');

    expect(token.name).toBe('sam.lee');
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).name).toBe('sam.lee');
  });
});
