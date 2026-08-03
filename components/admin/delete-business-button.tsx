'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'

export function DeleteBusinessButton({ id, name }: { id: string; name: string }) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()

  async function handleDelete() {
    setDeleting(true)
    const res = await fetch(`/api/admin/businesses/${id}`, { method: 'DELETE' })
    if (res.ok) {
      router.refresh()
    } else {
      alert('Delete failed — check console')
      setDeleting(false)
      setConfirming(false)
    }
  }

  if (confirming) {
    return (
      <span className="flex items-center gap-1.5 text-xs">
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-red-600 font-semibold hover:underline disabled:opacity-50"
        >
          {deleting ? 'Deleting…' : 'Confirm'}
        </button>
        <span className="text-slate-300">·</span>
        <button onClick={() => setConfirming(false)} className="text-slate-400 hover:underline">
          Cancel
        </button>
      </span>
    )
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      title={`Delete ${name}`}
      className="text-slate-300 hover:text-red-400 transition-colors"
    >
      <Trash2 size={14} />
    </button>
  )
}
