import ProductList from "@/components/shared/product/product-list";
// import sampleData from "@/db/sample-data";
import { getLatestProducts } from "@/lib/actions/product.actions";
import { Button } from "@/components/ui/button";

// const delay = (ms) => new Promise((resolve)=>setTimeout(resolve,ms));
const Homepage = async () => {
  // await delay(2000);
  const latestProducts = await getLatestProducts();
  return (
    <div className="space-y-8">
      {/* Test styling */}
      {/* <div className="p-4 bg-blue-500 text-white rounded-lg">
      <h1 className="text-2xl font-bold">Test Tailwind Styling</h1>
      <p>If you can see this blue box with white text, Tailwind CSS is working!</p>
      </div> */}
      
      {/* Test shadcn/ui button */}
      {/* <Button className="bg-green-500 hover:bg-green-600">Test shadcn/ui Button</Button> */}
      
      {/* <h2 className="h2-bold text-center text-slate-600">Newest Arrivals</h2> */}
      <ProductList data={latestProducts} title="Newest Arrivals" limit={4} />
    </div>
  );
};

export default Homepage;
