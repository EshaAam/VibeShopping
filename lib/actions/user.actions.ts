'use server';
import { signIn, signOut } from "@/auth";
import { signInFormSchema } from "../validator";
import { isRedirectError } from "next/dist/client/components/redirect-error";

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
// Sign the user out
export async function signOutUser() {
  await signOut();
}