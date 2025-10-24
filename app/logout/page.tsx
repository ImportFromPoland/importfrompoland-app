"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LogOut, ArrowLeft, CheckCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function LogoutPage() {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isLoggedOut, setIsLoggedOut] = useState(false);
  const router = useRouter();

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error("Error signing out:", error);
        alert("Błąd podczas wylogowywania: " + error.message);
        return;
      }
      
      // Wait a moment to show the loading state
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setIsLoggedOut(true);
      
      // Redirect to login after showing success message
      setTimeout(() => {
        router.push("/login");
      }, 2000);
      
    } catch (error) {
      console.error("Error during logout:", error);
      alert("Błąd podczas wylogowywania. Spróbuj ponownie.");
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleCancel = () => {
    router.back();
  };

  if (isLoggedOut) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <CardTitle className="text-xl text-green-800">Wylogowano pomyślnie!</CardTitle>
            <CardDescription>
              Zostałeś wylogowany z systemu. Przekierowujemy Cię do strony logowania...
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <LogOut className="h-6 w-6 text-red-600" />
          </div>
          <CardTitle className="text-xl">Potwierdź wylogowanie</CardTitle>
          <CardDescription>
            Czy na pewno chcesz się wylogować z systemu ImportFromPoland?
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col space-y-2">
            <Button
              onClick={handleLogout}
              disabled={isLoggingOut}
              variant="destructive"
              className="w-full"
            >
              {isLoggingOut ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Wylogowywanie...
                </>
              ) : (
                <>
                  <LogOut className="h-4 w-4 mr-2" />
                  Tak, wyloguj mnie
                </>
              )}
            </Button>
            
            <Button
              onClick={handleCancel}
              disabled={isLoggingOut}
              variant="outline"
              className="w-full"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Anuluj
            </Button>
          </div>
          
          <div className="text-center text-sm text-gray-500">
            Po wylogowaniu zostaniesz przekierowany do strony logowania
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


