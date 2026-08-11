"use client"

import { useState } from "react"
import { AlertTriangle } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface ReceivingCancelDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  receivingId: string | null
  deliveryNoteNumber: string
  onSuccess: () => void
}

export function ReceivingCancelDialog({ open, onOpenChange, receivingId, deliveryNoteNumber, onSuccess }: ReceivingCancelDialogProps) {
  const [reason, setReason] = useState("")
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")

  const handleCancel = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!receivingId) return
    if (!reason.trim()) {
      setErrorMsg("Alasan pembatalan wajib diisi.")
      return
    }

    setLoading(true)
    setErrorMsg("")
    try {
      const response = await fetch(`/api/receivings/${receivingId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error?.message || "Gagal membatalkan Surat Jalan.")
      onOpenChange(false)
      setReason("")
      onSuccess()
    } catch (error: unknown) {
      setErrorMsg(error instanceof Error ? error.message : "Terjadi kesalahan sistem.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive"><AlertTriangle /> Batalkan Surat Jalan</DialogTitle>
          <DialogDescription>Anda akan membatalkan Surat Jalan <strong>{deliveryNoteNumber}</strong>. Tindakan ini dicatat ke audit log.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleCancel} className="space-y-5">
          {errorMsg ? <Alert variant="destructive"><AlertDescription>{errorMsg}</AlertDescription></Alert> : null}
          <div className="space-y-2">
            <Label htmlFor="receiving-cancel-reason">Alasan Pembatalan *</Label>
            <Textarea id="receiving-cancel-reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Contoh: truck dipindahkan atau pengiriman dibatalkan" required className="min-h-24" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Batal</Button>
            <Button type="submit" variant="destructive" disabled={loading}>{loading ? "Memproses..." : "Ya, Batalkan Surat Jalan"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
