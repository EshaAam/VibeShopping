-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "order_userId_user_id_fk";

-- DropForeignKey
ALTER TABLE "OrderItem" DROP CONSTRAINT "orderItems_productId_product_id_fk";

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "order_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "orderItems_productId_product_id_fk" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

