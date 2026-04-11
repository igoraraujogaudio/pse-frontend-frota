import { apiClient } from '@/lib/apiClient'
import { DiscountOrder } from '@/types/discountOrder'

export const discountOrderService = {
  async getAll() {
    return apiClient.get<DiscountOrder[]>('/ordens-desconto')
  },

  async getById(id: string) {
    return apiClient.get<DiscountOrder>(`/ordens-desconto/${id}`, { silent: true })
  },

  async create(order: Partial<DiscountOrder>) {
    // PDF generation still goes through Next.js API route (binary response)
    const res = await fetch('/api/discount-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order),
    })
    if (!res.ok) {
      let error
      try { error = await res.json() } catch { throw new Error('Erro ao criar ordem') }
      throw new Error(error.error || 'Erro ao criar ordem')
    }

    const fileUrl = res.headers.get('X-Supabase-File-Url')
    const realOrderId = res.headers.get('X-Discount-Order-Id')

    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')

    return {
      id: realOrderId || crypto.randomUUID(),
      arquivo_assinado_url: fileUrl || url,
      ...order
    } as DiscountOrder
  },

  async update(id: string, updates: Partial<DiscountOrder>) {
    return apiClient.put<DiscountOrder>(`/ordens-desconto/${id}`, { body: updates })
  },

  async delete(id: string) {
    await apiClient.delete(`/ordens-desconto/${id}`)
    return { success: true }
  },

  async uploadSignedFile(orderId: string, file: File, action: 'assinado' | 'recusado' = 'assinado', testemunhas?: {
    testemunha1_nome: string
    testemunha1_cpf: string
    testemunha2_nome: string
    testemunha2_cpf: string
  }) {
    // 1. Upload via Next.js API route (server-side storage using backend)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('orderId', orderId)
    formData.append('action', action)

    const uploadRes = await fetch('/api/discount-orders/upload-signed', {
      method: 'POST',
      body: formData,
    })
    if (!uploadRes.ok) {
      const err = await uploadRes.json().catch(() => ({}))
      throw new Error(err.error || 'Erro no upload do arquivo assinado')
    }
    const { storagePath } = await uploadRes.json()

    // 2. Update order via Rust API
    const updateData: Partial<DiscountOrder> = {
      arquivo_assinado_url: storagePath,
      data_assinatura: new Date().toISOString(),
    }

    if (action === 'assinado') {
      updateData.status = 'assinada'
      updateData.recusado = false
    } else if (action === 'recusado') {
      updateData.status = 'recusada'
      updateData.recusado = true
      if (testemunhas) {
        updateData.testemunha1_nome = testemunhas.testemunha1_nome
        updateData.testemunha1_cpf = testemunhas.testemunha1_cpf
        updateData.testemunha2_nome = testemunhas.testemunha2_nome
        updateData.testemunha2_cpf = testemunhas.testemunha2_cpf
      }
    }

    const order = await apiClient.put<DiscountOrder>(`/ordens-desconto/${orderId}`, { body: updateData })

    // 3. Send email (fire-and-forget via Next.js API route)
    const bucket = 'ordens-desconto-pdfs'
    const fileName = storagePath.replace(`${bucket}/`, '')
    const signedUrl = await apiClient.getSignedUrl(bucket, fileName)
    try {
      fetch('/api/email/send-discount-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, fileUrl: signedUrl, action })
      }).catch(() => {})
    } catch { /* ignore */ }

    return { success: true, fileUrl: storagePath, order, action }
  }
}
