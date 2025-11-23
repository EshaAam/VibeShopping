import { APP_NAME } from "@/lib/constants";
import Image from "next/image";
import Link from "next/link";
import Menu from "./menu";

const Header = () => {
  return (
    <header className="w-full border-b">
      <div className="wrapper flex-between">
        <div className="flex-start">
          <Link href="/" className="flex-start">
            <Image
              priority={true}
              src="/images/logo.png"
              width={48}
              height={48}
              alt={`${APP_NAME} logo`}
            />
            <span className="hidden md:block lg:block ml-2 text-xl font-semibold text-gray-800 dark:text-gray-200">
              {APP_NAME}
            </span>
          </Link>
        </div>
        {/*menu for small screen   */}
        <Menu />
      </div>
    </header>
  );
};

export default Header;
