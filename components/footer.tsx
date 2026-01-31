import { APP_NAME } from "@/lib/constants";
import Link from "next/link";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
    Mail, 
    Phone, 
    MapPin, 
    ArrowRight,
    ShoppingBag,
    DollarSign,
    CreditCard,
    Headphones,
    Instagram,
    Facebook,
    Twitter,
    Youtube,
    Linkedin
} from "lucide-react";

const Footer = () => {
    const currentYear = new Date().getFullYear();

    const shopLinks = [
        { label: "All Products", href: "/search" },
        { label: "New Arrivals", href: "/search?sort=newest" },
        { label: "Best Sellers", href: "/search?sort=rating" },
        { label: "On Sale", href: "/search?sort=lowest" },
    ];

    const companyLinks = [
        { label: "About Us", href: "#" },
        { label: "Privacy Policy", href: "#" },
        { label: "Terms & Conditions", href: "#" },
        { label: "Return Policy", href: "#" },
    ];

    const features = [
        { icon: ShoppingBag, title: "Free Shipping", desc: "Orders above $100" },
        { icon: DollarSign, title: "Money Back", desc: "30 days guarantee" },
        { icon: CreditCard, title: "Flexible Payment", desc: "Card, PayPal, COD" },
        { icon: Headphones, title: "24/7 Support", desc: "Anytime help" },
    ];

    return ( 
        <footer className="bg-zinc-900 text-zinc-300">
            {/* Features Bar */}
            <div className="border-b border-zinc-800">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {features.map((feature, index) => (
                            <div key={index} className="flex items-center gap-2">
                                <div className="p-1.5 bg-zinc-800 rounded-lg">
                                    <feature.icon className="h-4 w-4 text-rose-500" />
                                </div>
                                <div>
                                    <p className="text-white text-xs font-semibold">{feature.title}</p>
                                    <p className="text-zinc-400 text-[10px]">{feature.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Main Footer Content */}
            <div className="max-w-7xl mx-auto px-4 py-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-10">
                    {/* Contact Section */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 mb-4">
                            <Image
                                src="/images/logo.png"
                                alt={APP_NAME}
                                width={32}
                                height={32}
                                className="rounded"
                            />
                            <span className="text-white text-lg font-bold">{APP_NAME}</span>
                        </div>
                        <h3 className="text-white font-semibold text-xs uppercase tracking-wider">Contact</h3>
                        <div className="space-y-2">
                            <a href="mailto:ekramul.esham@gmail.com" className="flex items-center gap-2 text-xs hover:text-rose-400 transition-colors">
                                <Mail className="h-3.5 w-3.5 text-rose-500" />
                                ekramul.esham@gmail.com
                            </a>
                            <a href="tel:+8801234567890" className="flex items-center gap-2 text-xs hover:text-rose-400 transition-colors">
                                <Phone className="h-3.5 w-3.5 text-rose-500" />
                                +880 1234 567 890
                            </a>
                            <div className="flex items-start gap-2 text-xs">
                                <MapPin className="h-3.5 w-3.5 text-rose-500 mt-0.5" />
                                <span>Dhaka, Bangladesh</span>
                            </div>
                        </div>
                    </div>

                    {/* Shop Links */}
                    <div className="space-y-3">
                        <h3 className="text-white font-semibold text-xs uppercase tracking-wider">Shop</h3>
                        <ul className="space-y-2">
                            {shopLinks.map((link, index) => (
                                <li key={index}>
                                    <Link 
                                        href={link.href}
                                        className="text-xs hover:text-rose-400 transition-colors hover:translate-x-1 inline-block"
                                    >
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Company Links */}
                    <div className="space-y-3">
                        <h3 className="text-white font-semibold text-xs uppercase tracking-wider">Company</h3>
                        <ul className="space-y-2">
                            {companyLinks.map((link, index) => (
                                <li key={index}>
                                    <Link 
                                        href={link.href}
                                        className="text-xs hover:text-rose-400 transition-colors hover:translate-x-1 inline-block"
                                    >
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Newsletter */}
                    <div className="space-y-3">
                        <h3 className="text-white font-semibold text-xs uppercase tracking-wider">Newsletter</h3>
                        <p className="text-xs text-zinc-400">
                            Be the first to hear about our latest offers.
                        </p>
                        <div className="flex gap-2">
                            <Input 
                                type="email" 
                                placeholder="Your email address"
                                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-rose-500 h-9 text-xs"
                            />
                            <Button size="icon" className="bg-rose-600 hover:bg-rose-700 h-9 w-9 shrink-0">
                                <ArrowRight className="h-4 w-4" />
                            </Button>
                        </div>
                        {/* Social Icons */}
                        <div className="flex items-center gap-2 pt-1">
                            <a href="#" className="p-1.5 bg-zinc-800 rounded-full hover:bg-rose-600 transition-colors">
                                <Instagram className="h-3.5 w-3.5" />
                            </a>
                            <a href="#" className="p-1.5 bg-zinc-800 rounded-full hover:bg-rose-600 transition-colors">
                                <Facebook className="h-3.5 w-3.5" />
                            </a>
                            <a href="#" className="p-1.5 bg-zinc-800 rounded-full hover:bg-rose-600 transition-colors">
                                <Twitter className="h-3.5 w-3.5" />
                            </a>
                            <a href="#" className="p-1.5 bg-zinc-800 rounded-full hover:bg-rose-600 transition-colors">
                                <Youtube className="h-3.5 w-3.5" />
                            </a>
                            <a href="#" className="p-1.5 bg-zinc-800 rounded-full hover:bg-rose-600 transition-colors">
                                <Linkedin className="h-3.5 w-3.5" />
                            </a>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Bar */}
            <div className="border-t border-zinc-800">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-2">
                        <p className="text-[10px] text-zinc-500">
                            Developed by <span className="text-rose-400 font-medium">Ekramul Esham</span>
                        </p>
                        <p className="text-[10px] text-zinc-500">
                            &copy; {currentYear} {APP_NAME}. All rights reserved.
                        </p>
                    </div>
                </div>
            </div>
        </footer>
     );
}
 
export default Footer;