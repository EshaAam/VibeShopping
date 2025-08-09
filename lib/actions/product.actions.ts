'use server';

import { LATEST_PRODUCTS_LIMIT } from "../constants";
// import { PrismaClient } from "@prisma/client";
import { convertToPlainObject } from "../utils";
import { prisma } from "@/db/prisma";

//get the latest products
export async function getLatestProducts() {
//   const prisma = new PrismaClient();

  const data = await prisma.product.findMany({
    take: LATEST_PRODUCTS_LIMIT,
    orderBy: { createdAt: 'desc' },
  });

  return convertToPlainObject(data);
}

//get a product by the slug
export async function getProductBySlug(slug: string) {
  return  await prisma.product.findUnique({
    where: { slug: slug },
  });
}