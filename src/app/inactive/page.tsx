import { LogOut } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Account Inactive - MenuQR",
};

export default function InactivePage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center space-y-6">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">🔒</span>
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900">Account Inactive</h1>
        
        <p className="text-gray-500">
          Your restaurant account has been deactivated. Your digital menu is currently offline and cannot accept new orders.
        </p>
        
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-sm text-orange-800">
          Please contact the platform administrator to reactivate your account and resume services.
        </div>

        <div className="pt-4">
          <Link href="/api/auth/signout?callbackUrl=/login">
            <Button variant="outline" className="w-full flex items-center justify-center gap-2">
              <LogOut className="w-4 h-4" />
              Sign Out
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
