"use client";

import { useEffect, useState } from "react";
import { Users, UserPlus, ShieldCheck, UserCheck, KeyRound, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { StatusBadge } from "@/components/ui/status-badge";
import { LoadingState } from "@/components/ui/states";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";

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
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);

  // Form States - Add
  const [addName, setAddName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addPassword, setAddPassword] = useState("");
  const [addRole, setAddRole] = useState<"ADMIN" | "OPERATOR">("OPERATOR");
  const [addAssignedLineId, setAddAssignedLineId] = useState("");
  const [addStatus, setAddStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  const [addError, setAddError] = useState<string | null>(null);
  const [addSubmitting, setAddSubmitting] = useState(false);

  // Form States - Edit User
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState<"ADMIN" | "OPERATOR">("OPERATOR");
  const [editAssignedLineId, setEditAssignedLineId] = useState("");
  const [editStatus, setEditStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  const [editError, setEditError] = useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Form States - Reset Password
  const [resetPassword, setResetPassword] = useState("");
  const [resetPasswordConfirmation, setResetPasswordConfirmation] = useState("");
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSubmitting, setResetSubmitting] = useState(false);

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
        throw new Error("Gagal mengambil data jalur.");
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
      setAddError("Operator wajib ditugaskan ke salah satu Jalur.");
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

    if (editRole === "OPERATOR" && !editAssignedLineId) {
      setEditError("Operator wajib ditugaskan ke salah satu Jalur.");
      return;
    }

    setEditSubmitting(true);
    try {
      const payload = {
        name: editName,
        email: editEmail,
        role: editRole,
        assignedLineId: editRole === "OPERATOR" ? editAssignedLineId : null,
        status: editStatus,
      };

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

  const handleOpenResetPassword = (user: UserItem) => {
    setSelectedUser(user);
    setResetPassword("");
    setResetPasswordConfirmation("");
    setResetError(null);
    setIsResetPasswordOpen(true);
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setResetError(null);

    if (resetPassword.length < 12) {
      setResetError("Password baru harus minimal 12 karakter.");
      return;
    }
    if (resetPassword !== resetPasswordConfirmation) {
      setResetError("Konfirmasi kata sandi harus sama dengan kata sandi baru.");
      return;
    }

    setResetSubmitting(true);
    try {
      const res = await fetch(`/api/users/${selectedUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: resetPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Gagal mereset kata sandi.");
      }

      setIsResetPasswordOpen(false);
      toast.success("Kata sandi pengguna berhasil direset.");
      fetchData();
    } catch (err: unknown) {
      setResetError(err instanceof Error ? err.message : "Gagal mereset kata sandi.");
    } finally {
      setResetSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kelola Pengguna & Peran"
        description="Manajemen pengguna dengan peran OPERATOR yang terikat ke jalur dan ADMIN."
        actions={<>
          <Button variant="outline" size="sm" onClick={fetchData} className="gap-1 min-h-[44px] sm:min-h-0">
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Muat ulang</span>
          </Button>
          <Button onClick={handleOpenAdd} size="sm" className="gap-1 min-h-[44px] sm:min-h-0">
            <UserPlus className="h-4 w-4" />
            <span>Tambah Pengguna Baru</span>
          </Button>
        </>}
      />

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Daftar Pengguna Terdaftar</CardTitle>
          <CardDescription className="text-xs">
            Password tersimpan dalam bentuk hash bcrypt (min 12 karakter) dan sesi menggunakan cookie HttpOnly.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          {loading ? (
            <LoadingState label="Memuat data pengguna" />
          ) : users.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground text-xs italic">
              Belum ada data pengguna.
            </p>
          ) : (
            <>
              {/* Mobile Cards View (< md) */}
              <div className="divide-y divide-border md:hidden">
                {users.map((u) => {
                  const isAdmin = u.roles.includes("ADMIN");
                  return (
                    <div key={u.id} className="p-4 space-y-2.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-sm text-foreground">{u.name}</span>
                        {isAdmin ? (
                          <StatusBadge tone="primary" className="gap-1">
                            <ShieldCheck className="size-3" /> ADMIN
                          </StatusBadge>
                        ) : (
                          <StatusBadge tone="info" className="gap-1">
                            <UserCheck className="size-3" /> OPERATOR
                          </StatusBadge>
                        )}
                      </div>

                      <div className="text-muted-foreground space-y-0.5">
                        <p><span className="font-medium text-foreground">{u.email}</span></p>
                        <p>
                          Jalur: {isAdmin ? 'Semua Jalur' : u.assignedLine ? `${u.assignedLine.name} (${u.assignedLine.lineCode})` : 'Belum Ditugaskan'}
                        </p>
                        <p>Status: <span className="font-medium text-foreground">{u.status === 'ACTIVE' ? 'AKTIF' : 'NONAKTIF'}</span></p>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenEdit(u)}
                          className="text-xs min-h-[44px] sm:min-h-0"
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenResetPassword(u)}
                          className="gap-1 text-xs min-h-[44px] sm:min-h-0"
                        >
                          <KeyRound className="size-3.5 text-warning-foreground" />
                          <span>Reset Sandi</span>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table View (>= md) */}
              <div className="hidden md:block rounded-md border overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted">
                    <TableRow>
                      <TableHead className="text-xs">Nama Pengguna</TableHead>
                      <TableHead className="text-xs">Email Login</TableHead>
                      <TableHead className="text-xs text-center">Peran MVP</TableHead>
                      <TableHead className="text-xs">Jalur Tugas</TableHead>
                      <TableHead className="text-xs text-center">Status</TableHead>
                      <TableHead className="text-xs">Terakhir Login</TableHead>
                      <TableHead className="text-xs text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u) => {
                      const isAdmin = u.roles.includes("ADMIN");
                      return (
                        <TableRow key={u.id}>
                          <TableCell className="text-xs font-medium text-foreground">{u.name}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{u.email}</TableCell>
                          <TableCell className="text-xs text-center">
                            {isAdmin ? (
                              <StatusBadge tone="primary" className="gap-1">
                                <ShieldCheck className="h-3 w-3" /> ADMIN
                              </StatusBadge>
                            ) : (
                              <StatusBadge tone="info" className="gap-1">
                                <UserCheck className="h-3 w-3" /> OPERATOR
                              </StatusBadge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-foreground">
                            {isAdmin ? (
                              <span className="text-muted-foreground italic">Semua Jalur</span>
                            ) : u.assignedLine ? (
                              <span className="font-medium text-muted-foreground">
                                {u.assignedLine.name} ({u.assignedLine.lineCode})
                              </span>
                            ) : (
                              <span className="text-destructive font-medium">Belum Ditugaskan</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-center">
                            {u.status === "ACTIVE" ? (
                              <StatusBadge tone="success">
                                AKTIF
                              </StatusBadge>
                            ) : (
                              <StatusBadge tone="neutral">
                                NONAKTIF
                              </StatusBadge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {u.lastLoginAt
                              ? new Date(u.lastLoginAt).toLocaleString("id-ID")
                              : "Belum pernah"}
                          </TableCell>
                          <TableCell className="text-xs text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenEdit(u)}
                                className="h-8 text-xs"
                              >
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenResetPassword(u)}
                                className="h-8 gap-1 text-xs text-warning-foreground"
                              >
                                <KeyRound className="size-3" />
                                <span>Reset Sandi</span>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Dialog Tambah Pengguna */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tambah Pengguna Baru</DialogTitle>
            <DialogDescription className="text-xs">
              Password minimal 12 karakter. Operator wajib memilih Jalur tugas.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddSubmit} className="space-y-4 text-xs mt-2">
            {addError && (
              <Alert variant="destructive"><AlertDescription>{addError}</AlertDescription></Alert>
            )}

            <div className="space-y-1">
              <Label htmlFor="add-user-name">Nama Lengkap</Label>
              <Input
                id="add-user-name"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder="Contoh: Budi Santoso"
                required
                className="text-xs min-h-[44px] sm:min-h-0"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="add-user-email">Email Login</Label>
              <Input
                id="add-user-email"
                type="email"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                placeholder="operator2@local.test"
                required
                className="text-xs min-h-[44px] sm:min-h-0"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="add-user-password">Kata Sandi (min. 12 Karakter)</Label>
              <Input
                id="add-user-password"
                type="password"
                value={addPassword}
                onChange={(e) => setAddPassword(e.target.value)}
                placeholder="Password rahasia minimal 12 karakter"
                required
                minLength={12}
                className="text-xs min-h-[44px] sm:min-h-0"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="add-user-role">Peran (Role)</Label>
                <Select value={addRole} onValueChange={(value) => setAddRole(value as typeof addRole)}>
                  <SelectTrigger id="add-user-role" className="w-full min-h-[44px] sm:min-h-0"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OPERATOR">OPERATOR</SelectItem>
                    <SelectItem value="ADMIN">ADMIN</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="add-user-status">Status Akun</Label>
                <Select value={addStatus} onValueChange={(value) => setAddStatus(value as typeof addStatus)}>
                  <SelectTrigger id="add-user-status" className="w-full min-h-[44px] sm:min-h-0"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">AKTIF</SelectItem>
                    <SelectItem value="INACTIVE">NONAKTIF</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {addRole === "OPERATOR" && (
              <div className="space-y-1">
                <Label htmlFor="add-user-line" className="text-primary">
                  Jalur Tugas Operator (Wajib)
                </Label>
                <Select value={addAssignedLineId} onValueChange={setAddAssignedLineId} required>
                  <SelectTrigger id="add-user-line" className="w-full min-h-[44px] sm:min-h-0"><SelectValue placeholder="Pilih jalur" /></SelectTrigger>
                  <SelectContent>
                    {lines.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.name} ({l.lineCode})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddOpen(false)}
                className="text-xs min-h-[44px] sm:min-h-0"
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={addSubmitting}
                className="min-h-[44px] sm:min-h-0"
              >
                {addSubmitting ? "Menyimpan..." : "Simpan Pengguna"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog 1: Edit Data Pengguna */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Data Pengguna</DialogTitle>
            <DialogDescription className="text-xs">
              Ubah data akun pengguna <strong>{selectedUser?.name}</strong>.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="space-y-4 text-xs mt-2">
            {editError && (
              <Alert variant="destructive"><AlertDescription>{editError}</AlertDescription></Alert>
            )}

            <div className="space-y-1">
              <Label htmlFor="edit-user-name">Nama Lengkap</Label>
              <Input
                id="edit-user-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
                className="text-xs min-h-[44px] sm:min-h-0"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="edit-user-email">Email Login</Label>
              <Input
                id="edit-user-email"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                required
                className="text-xs min-h-[44px] sm:min-h-0"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="edit-user-role">Peran (Role)</Label>
                <Select value={editRole} onValueChange={(value) => setEditRole(value as typeof editRole)}>
                  <SelectTrigger id="edit-user-role" className="w-full min-h-[44px] sm:min-h-0"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OPERATOR">OPERATOR</SelectItem>
                    <SelectItem value="ADMIN">ADMIN</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="edit-user-status">Status Akun</Label>
                <Select value={editStatus} onValueChange={(value) => setEditStatus(value as typeof editStatus)}>
                  <SelectTrigger id="edit-user-status" className="w-full min-h-[44px] sm:min-h-0"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">AKTIF</SelectItem>
                    <SelectItem value="INACTIVE">NONAKTIF</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {editRole === "OPERATOR" && (
              <div className="space-y-1">
                <Label htmlFor="edit-user-line" className="text-primary">
                  Jalur Tugas Operator (Wajib)
                </Label>
                <Select value={editAssignedLineId} onValueChange={setEditAssignedLineId} required>
                  <SelectTrigger id="edit-user-line" className="w-full min-h-[44px] sm:min-h-0"><SelectValue placeholder="Pilih jalur" /></SelectTrigger>
                  <SelectContent>
                    {lines.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.name} ({l.lineCode})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditOpen(false)}
                className="text-xs min-h-[44px] sm:min-h-0"
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={editSubmitting}
                className="min-h-[44px] sm:min-h-0"
              >
                {editSubmitting ? "Menyimpan..." : "Simpan Perubahan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog 2: Reset Password Terpisah */}
      <Dialog open={isResetPasswordOpen} onOpenChange={setIsResetPasswordOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="size-4 text-warning-foreground" />
              <span>Reset Kata Sandi Pengguna</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Setel kata sandi baru untuk pengguna <strong>{selectedUser?.name}</strong> ({selectedUser?.email}).
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleResetPasswordSubmit} className="space-y-4 text-xs mt-2">
            {resetError && (
              <Alert variant="destructive"><AlertDescription>{resetError}</AlertDescription></Alert>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="reset-password-input">Kata Sandi Baru</Label>
              <Input
                id="reset-password-input"
                type="password"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                placeholder="Minimal 12 karakter"
                required
                minLength={12}
                className="text-xs min-h-[44px] sm:min-h-0"
              />
              <p className="text-xs text-muted-foreground">
                Password baru harus memiliki panjang minimal 12 karakter.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reset-password-confirmation">Konfirmasi Kata Sandi Baru</Label>
              <Input
                id="reset-password-confirmation"
                type="password"
                value={resetPasswordConfirmation}
                onChange={(e) => setResetPasswordConfirmation(e.target.value)}
                placeholder="Ketik ulang kata sandi baru"
                required
                minLength={12}
                className="text-xs min-h-[44px] sm:min-h-0"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsResetPasswordOpen(false)}
                className="text-xs min-h-[44px] sm:min-h-0"
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={resetSubmitting}
                className="min-h-[44px] sm:min-h-0"
              >
                {resetSubmitting ? "Mereset..." : "Reset Kata Sandi"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
