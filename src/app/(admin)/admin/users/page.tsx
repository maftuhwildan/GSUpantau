"use client";

import { useEffect, useState } from "react";
import { Users, UserPlus, ShieldCheck, UserCheck, KeyRound, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface LineItem {
  id: string;
  lineCode: string;
  name: string;
}

interface UserItem {
  id: string;
  name: string;
  email: string;
  status: "ACTIVE" | "INACTIVE";
  assignedLineId?: string | null;
  assignedLine?: LineItem | null;
  roles: string[];
  lastLoginAt?: string | null;
  createdAt: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [lines, setLines] = useState<LineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog States
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

  // Form States - Add
  const [addName, setAddName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addPassword, setAddPassword] = useState("");
  const [addRole, setAddRole] = useState<"ADMIN" | "OPERATOR">("OPERATOR");
  const [addAssignedLineId, setAddAssignedLineId] = useState("");
  const [addStatus, setAddStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  const [addError, setAddError] = useState<string | null>(null);
  const [addSubmitting, setAddSubmitting] = useState(false);

  // Form States - Edit
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editRole, setEditRole] = useState<"ADMIN" | "OPERATOR">("OPERATOR");
  const [editAssignedLineId, setEditAssignedLineId] = useState("");
  const [editStatus, setEditStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  const [editError, setEditError] = useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [resUsers, resLines] = await Promise.all([
        fetch("/api/users"),
        fetch("/api/lines"),
      ]);

      if (!resUsers.ok) {
        throw new Error("Gagal mengambil data pengguna.");
      }
      if (!resLines.ok) {
        throw new Error("Gagal mengambil data jalur (line).");
      }

      const dataUsers = await resUsers.json();
      const dataLines = await resLines.json();

      setUsers(dataUsers.users ?? []);
      setLines(dataLines.lines ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenAdd = () => {
    setAddName("");
    setAddEmail("");
    setAddPassword("");
    setAddRole("OPERATOR");
    setAddAssignedLineId(lines[0]?.id ?? "");
    setAddStatus("ACTIVE");
    setAddError(null);
    setIsAddOpen(true);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);

    if (addPassword.length < 12) {
      setAddError("Password harus minimal 12 karakter.");
      return;
    }
    if (addRole === "OPERATOR" && !addAssignedLineId) {
      setAddError("Operator wajib ditugaskan ke salah satu Line.");
      return;
    }

    setAddSubmitting(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: addName,
          email: addEmail,
          password: addPassword,
          role: addRole,
          assignedLineId: addRole === "OPERATOR" ? addAssignedLineId : null,
          status: addStatus,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Gagal membuat pengguna baru.");
      }

      setIsAddOpen(false);
      fetchData();
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : "Gagal membuat pengguna.");
    } finally {
      setAddSubmitting(false);
    }
  };

  const handleOpenEdit = (user: UserItem) => {
    setSelectedUser(user);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditPassword("");
    setEditRole(user.roles.includes("ADMIN") ? "ADMIN" : "OPERATOR");
    setEditAssignedLineId(user.assignedLineId ?? lines[0]?.id ?? "");
    setEditStatus(user.status);
    setEditError(null);
    setIsEditOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setEditError(null);

    if (editPassword && editPassword.length < 12) {
      setEditError("Password baru harus minimal 12 karakter.");
      return;
    }
    if (editRole === "OPERATOR" && !editAssignedLineId) {
      setEditError("Operator wajib ditugaskan ke salah satu Line.");
      return;
    }

    setEditSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        name: editName,
        email: editEmail,
        role: editRole,
        assignedLineId: editRole === "OPERATOR" ? editAssignedLineId : null,
        status: editStatus,
      };
      if (editPassword) {
        payload.password = editPassword;
      }

      const res = await fetch(`/api/users/${selectedUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Gagal memperbarui pengguna.");
      }

      setIsEditOpen(false);
      fetchData();
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : "Gagal memperbarui pengguna.");
    } finally {
      setEditSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-card p-6 rounded-xl border border-border shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-foreground">Kelola Pengguna & Peran (User Management)</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Manajemen pengguna sistem RPA. Peran MVP dibatasi: OPERATOR (terikat ke Line) dan ADMIN.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} className="text-xs gap-1">
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Muat Ulang</span>
          </Button>
          <Button onClick={handleOpenAdd} className="bg-purple-600 hover:bg-purple-500 text-white text-xs gap-1.5">
            <UserPlus className="h-4 w-4" />
            <span>Tambah Pengguna Baru</span>
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 p-4 rounded-xl text-xs flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Daftar Pengguna Terdaftar</CardTitle>
          <CardDescription className="text-xs">
            Password tersimpan dalam bentuk hash bcrypt (min 12 karakter) dan sesi menggunakan cookie HttpOnly.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-xs text-muted-foreground">Memuat data pengguna...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800 font-semibold border-b border-border">
                  <tr>
                    <th className="p-3">Nama Pengguna</th>
                    <th className="p-3">Email Login</th>
                    <th className="p-3 text-center">Peran MVP</th>
                    <th className="p-3">Line Tugas</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3">Terakhir Login</th>
                    <th className="p-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-muted-foreground">
                        Belum ada data pengguna.
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => {
                      const isAdmin = u.roles.includes("ADMIN");
                      return (
                        <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                          <td className="p-3 font-semibold text-foreground">{u.name}</td>
                          <td className="p-3 font-mono text-purple-700 dark:text-purple-400">{u.email}</td>
                          <td className="p-3 text-center">
                            {isAdmin ? (
                              <Badge variant="default" className="bg-purple-600 text-[10px] gap-1">
                                <ShieldCheck className="h-3 w-3" /> ADMIN
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px] gap-1">
                                <UserCheck className="h-3 w-3" /> OPERATOR
                              </Badge>
                            )}
                          </td>
                          <td className="p-3 text-foreground">
                            {isAdmin ? (
                              <span className="text-slate-400 italic">Semua Line</span>
                            ) : u.assignedLine ? (
                              <span className="font-medium text-slate-700 dark:text-slate-300">
                                {u.assignedLine.name} ({u.assignedLine.lineCode})
                              </span>
                            ) : (
                              <span className="text-red-500 font-medium">Belum Ditugaskan</span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            {u.status === "ACTIVE" ? (
                              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px]">
                                AKTIF
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-300 text-[10px]">
                                INAKTIF
                              </Badge>
                            )}
                          </td>
                          <td className="p-3 text-slate-500">
                            {u.lastLoginAt
                              ? new Date(u.lastLoginAt).toLocaleString("id-ID")
                              : "Belum pernah"}
                          </td>
                          <td className="p-3 text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenEdit(u)}
                              className="h-7 text-[11px]"
                            >
                              Edit / Reset
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog Tambah Pengguna */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Tambah Pengguna Baru</DialogTitle>
            <DialogDescription className="text-xs">
              Password minimal 12 karakter. Operator wajib memilih Line tugas.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddSubmit} className="space-y-4 text-xs mt-2">
            {addError && (
              <div className="p-3 rounded-lg bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300 border border-red-200">
                {addError}
              </div>
            )}

            <div className="space-y-1">
              <label className="font-semibold text-foreground">Nama Lengkap</label>
              <Input
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder="Contoh: Budi Santoso"
                required
                className="text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-foreground">Email Login</label>
              <Input
                type="email"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                placeholder="operator2@local.test"
                required
                className="text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-foreground">Password (min. 12 Karakter)</label>
              <Input
                type="password"
                value={addPassword}
                onChange={(e) => setAddPassword(e.target.value)}
                placeholder="Password rahasia minimal 12 huruf/angka"
                required
                minLength={12}
                className="text-xs font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Peran (Role)</label>
                <select
                  value={addRole}
                  onChange={(e) => setAddRole(e.target.value as "ADMIN" | "OPERATOR")}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus-visible:outline-none"
                >
                  <option value="OPERATOR">OPERATOR</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">Status Akun</label>
                <select
                  value={addStatus}
                  onChange={(e) => setAddStatus(e.target.value as "ACTIVE" | "INACTIVE")}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus-visible:outline-none"
                >
                  <option value="ACTIVE">AKTIF</option>
                  <option value="INACTIVE">INAKTIF</option>
                </select>
              </div>
            </div>

            {addRole === "OPERATOR" && (
              <div className="space-y-1">
                <label className="font-semibold text-foreground text-purple-700 dark:text-purple-400">
                  Line Tugas Operator (Wajib)
                </label>
                <select
                  value={addAssignedLineId}
                  onChange={(e) => setAddAssignedLineId(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus-visible:outline-none"
                  required
                >
                  {lines.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} ({l.lineCode})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddOpen(false)}
                className="text-xs"
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={addSubmitting}
                className="bg-purple-600 hover:bg-purple-500 text-white text-xs"
              >
                {addSubmitting ? "Menyimpan..." : "Simpan Pengguna"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Edit Pengguna / Reset Password */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Edit Pengguna & Reset Password</DialogTitle>
            <DialogDescription className="text-xs">
              Ubah data akun pengguna atau setel ulang password (kosongkan password jika tidak ingin diubah).
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="space-y-4 text-xs mt-2">
            {editError && (
              <div className="p-3 rounded-lg bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300 border border-red-200">
                {editError}
              </div>
            )}

            <div className="space-y-1">
              <label className="font-semibold text-foreground">Nama Lengkap</label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
                className="text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-foreground">Email Login</label>
              <Input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                required
                className="text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-foreground flex items-center gap-1">
                <KeyRound className="h-3.5 w-3.5 text-purple-600" />
                <span>Reset Password Baru (Opsional, min. 12 Karakter)</span>
              </label>
              <Input
                type="password"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                placeholder="Biarkan kosong jika tidak mereset password"
                minLength={12}
                className="text-xs font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Peran (Role)</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as "ADMIN" | "OPERATOR")}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus-visible:outline-none"
                >
                  <option value="OPERATOR">OPERATOR</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">Status Akun</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as "ACTIVE" | "INACTIVE")}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus-visible:outline-none"
                >
                  <option value="ACTIVE">AKTIF</option>
                  <option value="INACTIVE">INAKTIF</option>
                </select>
              </div>
            </div>

            {editRole === "OPERATOR" && (
              <div className="space-y-1">
                <label className="font-semibold text-foreground text-purple-700 dark:text-purple-400">
                  Line Tugas Operator (Wajib)
                </label>
                <select
                  value={editAssignedLineId}
                  onChange={(e) => setEditAssignedLineId(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus-visible:outline-none"
                  required
                >
                  {lines.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} ({l.lineCode})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditOpen(false)}
                className="text-xs"
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={editSubmitting}
                className="bg-purple-600 hover:bg-purple-500 text-white text-xs"
              >
                {editSubmitting ? "Menyimpan..." : "Simpan Perubahan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
