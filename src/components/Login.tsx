import { Button } from "./ui/button";
import { SignInButton, SignUpButton } from "@clerk/clerk-react";

export default function Login() {
  return (
    <div className="min-h-screen relative flex items-center justify-center p-4">
      {/* Background Image */}
      <div className="absolute inset-0 login-background">
        <div className="absolute inset-0 bg-black/20"></div>
      </div>

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-md">
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-8 shadow-2xl border border-white/20">
          <div className="text-center space-y-6">
            {/* Logo/Title */}
            <div className="space-y-2">
              <h1 className="text-3xl font-bold text-green-800">
                Sistem Monitoring
              </h1>
              <p className="text-green-600">
                Dashboard Operasional
              </p>
            </div>

            {/* Company Info */}
            <div className="space-y-1">
              <p className="text-sm text-gray-600">
                PT. Belitang Panen Raya
              </p>
              <p className="text-xs text-gray-500">
                Sistem Monitoring
              </p>
            </div>

            {/* Login Button */}
            <div className="flex flex-col gap-3">
              <SignInButton mode="modal">
                <Button
                  className="w-full bg-green-700 hover:bg-green-800 text-white py-3 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl"
                  size="lg"
                >
                  Masuk ke Dashboard
                </Button>
              </SignInButton>
              <SignUpButton mode="modal">
                <Button
                  variant="outline"
                  className="w-full border-green-700 text-green-700 hover:bg-green-50 py-3 rounded-xl transition-all duration-200"
                  size="lg"
                >
                  Daftar Akun Baru
                </Button>
              </SignUpButton>
            </div>

            {/* Footer */}
            <p className="text-xs text-gray-500 mt-4">
              Akses aman ke data operasional
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}