import { Users, UserPlus, ShieldCheck, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function AdminUsersPage() {
  const users = [
    { id: "usr-1", name: "Operator Lapangan", email: "operator@local.test", role: "OPERATOR", status: "AKTIF", lastLogin: "Hari ini 09:30" },
    { id: "usr-2", name: "Administrator RPA", email: "admin@local.test", role: "ADMIN", status: "AKTIF", lastLogin: "Hari ini 10:15" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-card p-6 rounded-xl border border-border shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-foreground">Kelola Pengguna & Peran (User Management)</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Manajemen pengguna sistem. MVP dibatasi 2 peran resmi: OPERATOR dan ADMIN.
          </p>
        </div>
        <Button className="bg-purple-600 hover:bg-purple-500 text-white text-xs gap-1.5">
          <UserPlus className="h-4 w-4" />
          <span>Tambah Pengguna Baru</span>
        </Button>
      </div>

      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Daftar Pengguna Terdaftar</CardTitle>
          <CardDescription className="text-xs">
            Password tersimpan dalam bentuk hash dan sesi menggunakan cookie HttpOnly yang aman.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800 font-semibold border-b border-border">
                <tr>
                  <th className="p-3">Nama Pengguna</th>
                  <th className="p-3">Email Login</th>
                  <th className="p-3 text-center">Peran MVP</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3">Terakhir Login</th>
                  <th className="p-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                    <td className="p-3 font-semibold text-foreground">{u.name}</td>
                    <td className="p-3 font-mono text-purple-700 dark:text-purple-400">{u.email}</td>
                    <td className="p-3 text-center">
                      {u.role === "ADMIN" ? (
                        <Badge variant="default" className="bg-purple-600 text-[10px] gap-1">
                          <ShieldCheck className="h-3 w-3" /> ADMIN
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px] gap-1">
                          <UserCheck className="h-3 w-3" /> OPERATOR
                        </Badge>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <Badge variant="success" className="text-[10px]">{u.status}</Badge>
                    </td>
                    <td className="p-3 text-slate-500">{u.lastLogin}</td>
                    <td className="p-3 text-right">
                      <Button size="sm" variant="outline" className="h-7 text-[11px]">
                        Edit User
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
