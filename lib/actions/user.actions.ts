"use server";
import { signIn, signOut, auth } from "@/auth";
import { signInFormSchema, signUpFormSchema, shippingAddressSchema, paymentMethodSchema, updateUserSchema } from "../validator";
import { z } from 'zod';
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { hashSync } from "bcrypt-ts-edge";
import { prisma } from "@/db/prisma";
import { formatError } from "../utils";
import { ShippingAddress } from "@/types";
import { USER_ROLES } from '@/lib/constants';
import { requireAdmin } from '../auth-guard';
import { revalidatePath } from 'next/cache';

export async function signInWithCredentials(
  prevState: unknown,
  formData: FormData
) {
  try {
    const user = signInFormSchema.parse({
      //gets the value of the input field
      email: formData.get("email"),
      password: formData.get("password"),
    });
    await signIn("credentials", user);

    return { success: true, message: "Signed in successfully!" };
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    return { success: false, message: "Invalid email or username" };
  }
}

//register a new user
export async function signUpUser(prevState: unknown, formData: FormData) {
  try {
    const user = signUpFormSchema.parse({
      name: formData.get("name"),
      email: formData.get("email"),
      password: formData.get("password"),
      confirmPassword: formData.get("confirmPassword"),
    });
    const plainPassword = formData.get("password") as string;

    user.password = hashSync(user.password, 10);
    // Create the user in the database
    await prisma.user.create({
      data: {
        name: user.name,
        email: user.email,
        password: user.password,
      },
    });

    await signIn("credentials", {
      email: user.email, 
      password: plainPassword,
    });

    return { success: true, message: "Signed up successfully!" };
  } catch (error) {
    // console.log(error.name);
    // console.log(error.code);
    // console.log(error.errors);
    // console.log(error.meta?.target);
    if (isRedirectError(error)) {
      throw error;
    }
    return { success: false, message: formatError(error) };
  }
}

// Sign the user out
export async function signOutUser() {
  await signOut();
}

// Update user's address
export async function updateUserAddress(data: ShippingAddress) {
  try {
    const session = await auth();

    if (!session?.user?.id) throw new Error('Unauthorized');

    const currentUser = await prisma.user.findFirst({
      where: { id: session.user.id },
    });

    if (!currentUser) throw new Error('User not found');

    const address = shippingAddressSchema.parse(data);

    await prisma.user.update({
      where: { id: currentUser.id },
      data: { address },
    });

    return {
      success: true,
      message: 'User updated successfully',
    };
  } catch (error) {
    return { success: false, message: formatError(error) };
  }
}

// Update user's payment method
export async function updateUserPaymentMethod(
  data: z.infer<typeof paymentMethodSchema>
) {
  try {
    const session = await auth();

    if (!session?.user?.id) throw new Error('Unauthorized');

    const currentUser = await prisma.user.findFirst({
      where: { id: session.user.id },
    });

    if (!currentUser) throw new Error('User not found');

    const paymentMethod = paymentMethodSchema.parse(data);

    await prisma.user.update({
      where: { id: currentUser.id },
      data: { paymentMethod: paymentMethod.type },
    });

    return {
      success: true,
      message: 'User updated successfully',
    };
  } catch (error) {
    return { success: false, message: formatError(error) };
  }
}

// Update User Profile
export async function updateProfile(user: { name: string; email: string }) {
  try {
    const session = await auth();

    if (!session?.user?.id) throw new Error('Unauthorized');

    const currentUser = await prisma.user.findFirst({
      where: {
        id: session.user.id,
      },
    });

    if (!currentUser) throw new Error('User not found');

    await prisma.user.update({
      where: {
        id: currentUser.id,
      },
      data: {
        name: user.name,
      },
    });

    return {
      success: true,
      message: 'User updated successfully',
    };
  } catch (error) {
    return { success: false, message: formatError(error) };
  }
}

// Delete user by ID
export async function deleteUser(id: string) {
  try {
    await requireAdmin();

    // Orders are financial records and outlive the account that placed them.
    const hasOrders = await prisma.order.findFirst({ where: { userId: id } });
    if (hasOrders) {
      throw new Error('This user has orders and cannot be deleted.');
    }

    await prisma.user.delete({ where: { id } });

    revalidatePath('/admin/users');

    return {
      success: true,
      message: 'User deleted successfully',
    };
  } catch (error) {
    return { success: false, message: formatError(error) };
  }
}

// Update user
export async function updateUser(data: z.infer<typeof updateUserSchema>) {
  try {
    await requireAdmin();

    const user = updateUserSchema.parse(data);
    if (!(USER_ROLES as readonly string[]).includes(user.role)) {
      throw new Error('Invalid role');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        name: user.name,
        role: user.role,
      },
    });

    revalidatePath('/admin/users');

    return {
      success: true,
      message: 'User updated successfully',
    };
  } catch (error) {
    return { success: false, message: formatError(error) };
  }
}
