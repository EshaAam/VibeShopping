import { APP_NAME } from "@/lib/constants";

const Footer = () => {
    const currentYear = new Date().getFullYear();

    return ( 
        <footer className="">
            <div className="wrapper flex justify-center items-center py-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    &copy; {currentYear} {APP_NAME}. All rights reserved.
                </p>
            </div>
        </footer>
     );
}
 
export default Footer;