"use server";
import { signIn, signOut } from "@/auth";
import { signInFormSchema, signUpFormSchema } from "../validator";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { hashSync } from "bcrypt-ts-edge";
import { prisma } from "@/db/prisma";

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
