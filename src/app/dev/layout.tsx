import React from "react";
import { getAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DevLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthSession();

  if (!user) {
    redirect("/login");
  }

  if (!user.roles.includes("ADMIN")) {
    redirect("/dashboard");
  }

  return children;
}
