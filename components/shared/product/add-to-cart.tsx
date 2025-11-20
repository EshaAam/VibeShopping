"use client";

import { Button } from "@/components/ui/button";
import { ToastAction } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";
import { addItemToCart } from "@/lib/actions/cart.actions";
import { CartItem } from "@/types";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";

const AddToCart = ({ item }: { item: CartItem }) => {
  // useRouter allows you to navigate to a route without requiring a <Link> component or a user clicking on a traditional link.
  const router = useRouter();
  const { toast } = useToast();

  const handleAddToCart = async () => {
    // Execute the addItemToCart action
    const res = await addItemToCart(item);

    // Display appropriate toast message based on the result
    if (!res.success) {
      toast({
        variant: "destructive",
        description: res.message,
      });
      return;
    }

    toast({
      description: res.message,
      action: (
        <ToastAction
          className="bg-primary text-white hover:bg-gray-800"
          onClick={() => router.push("/cart")}
          altText="Go to cart"
        >
          Go to cart
        </ToastAction>
      ),
    });
  };

  return (
    <Button
      className="w-full flex items-center justify-center gap-2 px-4 py-2 text-base md:text-lg"
      type="button"
      onClick={handleAddToCart}
    >
      {/* <Plus className="w-5 h-5" /> */}
      <span className="truncate">Add To Cart</span>
    </Button>
  );
};

export default AddToCart;
