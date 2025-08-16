import { z } from 'zod';
import { formatNumberWithDecimal } from "./utils";
// Schema for inserting a product
// This schema defines the structure and validation rules for product data
// It ensures that all required fields are present and meet specified criteria
// The schema is used to validate product data before it is inserted into the database
const currency = z.string().refine((value) => /^\d+(\.\d{2})?$/.test(formatNumberWithDecimal(Number(value))), {
  message: "Price must be a valid currency format with two decimal places",
});
//schema for inserting a product
export const insertProductSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  slug: z.string().min(3, "Slug must be at least 3 characters"),
  category: z.string().min(3, "Category must be at least 3 characters"),
  brand: z.string().min(3, "Brand must be at least 3 characters"),
  description: z.string().min(3, "Description must be at least 3 characters"),
  stock: z.coerce.number(),
  images: z.array(z.string()).min(1, "Product must have at least one image"),
  isFeatured: z.boolean(),
  banner: z.string().nullable(),
  price: currency,
});

//schema for signing in users
export const signInFormSchema = z.object({
  email: z.string().email("Invalid email address").min(3, "Email must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});
