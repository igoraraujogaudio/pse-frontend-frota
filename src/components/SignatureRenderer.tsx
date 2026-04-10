import React from 'react'

interface SignatureData {
  paths: string[]
  width: number
  height: number
  timestamp?: number
}

interface SignatureRendererProps {
  signatureData: string | SignatureData
  width?: number
  height?: number
  className?: string
}

export const SignatureRenderer: React.FC<SignatureRendererProps> = ({
  signatureData,
  width = 300,
  height = 120,
  className = ''
}) => {
  // Verificar se é string JSON ou objeto
  let parsedData: SignatureData | null = null
  
  try {
    if (typeof signatureData === 'string') {
      parsedData = JSON.parse(signatureData)
    } else if (typeof signatureData === 'object' && signatureData !== null) {
      parsedData = signatureData
    }
  } catch (error) {
    console.log('❌ Erro ao fazer parse da assinatura:', error)
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-center min-h-[120px] ${className}`}>
        <span className="text-red-600 text-sm text-center">Erro ao carregar assinatura</span>
      </div>
    )
  }

  if (!parsedData || !parsedData.paths || parsedData.paths.length === 0) {
    return (
      <div className={`bg-gray-50 border border-gray-200 rounded-lg p-4 flex items-center justify-center min-h-[120px] ${className}`}>
        <span className="text-gray-500 text-sm text-center">Assinatura não disponível</span>
      </div>
    )
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-2 flex items-center justify-center ${className}`} style={{ width, height }}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${parsedData.width || width} ${parsedData.height || height}`}
        className="max-w-full max-h-full"
      >
        {parsedData.paths.map((pathData, index) => (
          <path
            key={index}
            d={pathData}
            stroke="#000000"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </svg>
    </div>
  )
}

