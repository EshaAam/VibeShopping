import Link from "next/link";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { signOutUser } from "@/lib/actions/user.actions";
import ProfileDropdown from "./profile-dropdown";

const UserButton = async () => {
  const session = await auth();
  if (!session) {
    return (
      <Link href="/api/auth/signin">
        <Button>Sign In</Button>
      </Link>
    );
  }

  const profileData = {
    name: session.user?.name ?? "User",
    email: session.user?.email ?? "",
    avatar: session.user?.image,
    role: session.user?.role,
  };

  return (
    <ProfileDropdown 
      data={profileData}
      isAdmin={session.user?.role === 'admin'}
      signOutAction={signOutUser}
    />
  );
};

export default UserButton;
