'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Separator } from '@/components/ui/separator'
import {
  Upload,
  Sparkles,
  Download,
  Wand2,
  Image as ImageIcon,
  Palette,
  FileText,
  Layers,
  Settings,
  MessageSquare,
  Check,
  X,
  RefreshCw,
  Zap,
  Type,
  Maximize2,
  Minimize2,
  Copy,
  Trash2,
  Info
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

// Types
type VectorizationMode = 'standard' | 'artistic' | 'logo' | 'photo' | 'sketch'
type ExportFormat = 'svg' | 'pdf' | 'png' | 'eps' | 'dxf' | 'ai'
type ColorMode = 'positive' | 'negative'
type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

type VectorizationOptions = {
  mode: VectorizationMode
  colorMode: ColorMode
  detailLevel: number
  smoothness: number
  colorCount: number
  preserveColors: boolean
  removeBackground: boolean
  optimizeForPrint: boolean
}

export default function ArmandosVector() {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // State
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string>('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [isVectorized, setIsVectorized] = useState(false)
  const [vectorizedResult, setVectorizedResult] = useState<string>('')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: '¡Hola! Soy tu asistente de diseño experto en vectorización. ¿En qué puedo ayudarte hoy? Puedo ayudarte a vectorizar imágenes, modificar diseños, reconocer fuentes, y mucho más.',
      timestamp: new Date()
    }
  ])
  const [chatInput, setChatInput] = useState('')
  const [isChatLoading, setIsChatLoading] = useState(false)

  const [vectorOptions, setVectorOptions] = useState<VectorizationOptions>({
    mode: 'standard',
    colorMode: 'positive',
    detailLevel: 75,
    smoothness: 50,
    colorCount: 16,
    preserveColors: true,
    removeBackground: false,
    optimizeForPrint: false
  })

  const [exportFormat, setExportFormat] = useState<ExportFormat>('svg')
  const [dragActive, setDragActive] = useState(false)
  const [useAI, setUseAI] = useState(false) // Default to basic mode (free)

  // Handle file selection
  const handleFileSelect = useCallback((file: File) => {
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/bmp']
    if (!validTypes.includes(file.type)) {
      toast({
        title: 'Formato no válido',
        description: 'Por favor sube una imagen en formato PNG, JPEG, GIF, WebP o BMP',
        variant: 'destructive'
      })
      return
    }

    setSelectedFile(file)
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    setIsVectorized(false)
    setVectorizedResult('')

    toast({
      title: 'Imagen cargada',
      description: file.name
    })
  }, [toast])

  // Drag and drop handlers
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      handleFileSelect(files[0])
    }
  }, [handleFileSelect])

  // Vectorize image
  const handleVectorize = async () => {
    if (!selectedFile) {
      toast({
        title: 'No hay imagen seleccionada',
        description: 'Por favor carga una imagen primero',
        variant: 'destructive'
      })
      return
    }

    setIsProcessing(true)

    try {
      const formData = new FormData()
      formData.append('image', selectedFile)
      formData.append('options', JSON.stringify(vectorOptions))
      formData.append('useAI', useAI.toString())

      const response = await fetch('/api/vectorize', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (!response.ok) {
        // Check if it's a credit error
        if (result.isCreditError || response.status === 402) {
          toast({
            title: 'Créditos insuficientes',
            description: 'El modo IA requiere créditos en Replicate. Usa el modo Básico (Gratis) o compra créditos.',
            variant: 'destructive'
          })
          return
        }
        throw new Error(result.error || 'Error al vectorizar la imagen')
      }

      setVectorizedResult(result.vectorizedImage)
      setIsVectorized(true)

      // Show mode message if present
      if (result.message) {
        toast({
          title: 'Vectorización completada',
          description: result.message
        })
      } else {
        toast({
          title: '¡Vectorización completada!',
          description: `Tu imagen ha sido vectorizada en modo ${result.mode === 'ai' ? 'IA' : 'básico'}`
        })
      }

      // Apply positive/negative if needed (only for AI mode since basic handles it)
      if (result.mode === 'ai' && vectorOptions.colorMode === 'negative' && canvasRef.current) {
        applyNegativeEffect()
      }
    } catch (error) {
      console.error('Vectorization error:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Hubo un error al vectorizar la imagen',
        variant: 'destructive'
      })
    } finally {
      setIsProcessing(false)
    }
  }

  // Apply negative effect (invert colors)
  const applyNegativeEffect = () => {
    if (!canvasRef.current || !previewUrl) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const img = new Image()
    img.onload = () => {
      canvas.width = img.width
      canvas.height = img.height
      ctx.drawImage(img, 0, 0)

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const data = imageData.data

      for (let i = 0; i < data.length; i += 4) {
        data[i] = 255 - data[i]         // Red
        data[i + 1] = 255 - data[i + 1] // Green
        data[i + 2] = 255 - data[i + 2] // Blue
      }

      ctx.putImageData(imageData, 0, 0)
      setVectorizedResult(canvas.toDataURL('image/png'))
    }
    img.src = vectorizedResult || previewUrl
  }

  // Export vectorized image
  const handleExport = async () => {
    if (!isVectorized) {
      toast({
        title: 'Sin vectorizar',
        description: 'Primero debes vectorizar la imagen',
        variant: 'destructive'
      })
      return
    }

    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          imageData: vectorizedResult,
          format: exportFormat,
          options: vectorOptions
        })
      })

      if (!response.ok) {
        throw new Error('Error al exportar')
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `armandos-vector.${exportFormat}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast({
        title: '¡Exportado!',
        description: `Imagen exportada en formato ${exportFormat.toUpperCase()}`
      })
    } catch (error) {
      console.error('Export error:', error)
      toast({
        title: 'Error al exportar',
        description: 'Hubo un error al exportar la imagen',
        variant: 'destructive'
      })
    }
  }

  // Send chat message
  const handleSendMessage = async () => {
    if (!chatInput.trim()) return

    const userMessage: ChatMessage = {
      role: 'user',
      content: chatInput,
      timestamp: new Date()
    }

    setChatMessages(prev => [...prev, userMessage])
    setChatInput('')
    setIsChatLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: chatInput,
          imageContext: selectedFile ? previewUrl : null,
          history: chatMessages
        })
      })

      if (!response.ok) {
        throw new Error('Error en el chat')
      }

      const data = await response.json()
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.response,
        timestamp: new Date()
      }

      setChatMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      console.error('Chat error:', error)
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: 'Lo siento, hubo un error al procesar tu mensaje. Por favor intenta de nuevo.',
        timestamp: new Date()
      }
      setChatMessages(prev => [...prev, errorMessage])
    } finally {
      setIsChatLoading(false)
    }
  }

  // Modify image with AI
  const handleAIModification = async (prompt: string) => {
    if (!selectedFile) {
      toast({
        title: 'No hay imagen',
        description: 'Por favor carga una imagen primero',
        variant: 'destructive'
      })
      return
    }

    setIsProcessing(true)

    try {
      const formData = new FormData()
      formData.append('image', selectedFile)
      formData.append('prompt', prompt)

      const response = await fetch('/api/modify-image', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error('Error al modificar la imagen')
      }

      const result = await response.json()
      setPreviewUrl(result.modifiedImage)

      toast({
        title: '¡Imagen modificada!',
        description: 'La IA ha modificado tu imagen exitosamente'
      })
    } catch (error) {
      console.error('Modification error:', error)
      toast({
        title: 'Error',
        description: 'Hubo un error al modificar la imagen',
        variant: 'destructive'
      })
    } finally {
      setIsProcessing(false)
    }
  }

  // Recognize font
  const handleRecognizeFont = async () => {
    if (!selectedFile) {
      toast({
        title: 'No hay imagen',
        description: 'Por favor carga una imagen primero',
        variant: 'destructive'
      })
      return
    }

    setIsChatLoading(true)

    try {
      const formData = new FormData()
      formData.append('image', selectedFile)

      const response = await fetch('/api/recognize-font', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error('Error al reconocer fuente')
      }

      const data = await response.json()

      const fontMessage: ChatMessage = {
        role: 'assistant',
        content: `🔍 **Análisis de Fuente:**\n\n${data.fontAnalysis}\n\n¿Te gustaría que te ayude a encontrar una fuente similar o a modificar el texto?`,
        timestamp: new Date()
      }

      setChatMessages(prev => [...prev, fontMessage])
    } catch (error) {
      console.error('Font recognition error:', error)
      toast({
        title: 'Error',
        description: 'Hubo un error al reconocer la fuente',
        variant: 'destructive'
      })
    } finally {
      setIsChatLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-lg sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 gradient-primary rounded-xl flex items-center justify-center glow-primary">
                <Sparkles className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold gradient-text">Armando's Vector</h1>
                <p className="text-sm text-muted-foreground">Vectorización Profesional con IA</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1">
                <Zap className="w-3 h-3" />
                Powered by AI
              </Badge>
              <Button variant="ghost" size="icon">
                <Settings className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="vectorize" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 max-w-2xl mx-auto">
            <TabsTrigger value="vectorize" className="gap-2">
              <Wand2 className="w-4 h-4" />
              Vectorizar
            </TabsTrigger>
            <TabsTrigger value="options" className="gap-2">
              <Settings className="w-4 h-4" />
              Opciones
            </TabsTrigger>
            <TabsTrigger value="modify" className="gap-2">
              <Palette className="w-4 h-4" />
              Modificar
            </TabsTrigger>
            <TabsTrigger value="chat" className="gap-2">
              <MessageSquare className="w-4 h-4" />
              Asistente IA
            </TabsTrigger>
          </TabsList>

          {/* Vectorize Tab */}
          <TabsContent value="vectorize" className="space-y-6">
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Upload Section */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="w-5 h-5" />
                    Cargar Imagen
                  </CardTitle>
                  <CardDescription>
                    Arrastra y suelta tu imagen o haz clic para seleccionar
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!previewUrl ? (
                    <div
                      className={`drop-zone rounded-xl p-12 text-center cursor-pointer transition-all ${
                        dragActive ? 'drag-over' : ''
                      }`}
                      onDragEnter={handleDrag}
                      onDragLeave={handleDrag}
                      onDragOver={handleDrag}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <div className="flex flex-col items-center gap-4">
                        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                          <ImageIcon className="w-10 h-10 text-primary" />
                        </div>
                        <div>
                          <p className="text-lg font-medium mb-1">
                            Arrastra tu imagen aquí
                          </p>
                          <p className="text-sm text-muted-foreground">
                            o haz clic para explorar
                          </p>
                        </div>
                        <div className="flex gap-2 mt-2">
                          <Badge variant="secondary">PNG</Badge>
                          <Badge variant="secondary">JPG</Badge>
                          <Badge variant="secondary">WEBP</Badge>
                          <Badge variant="secondary">GIF</Badge>
                          <Badge variant="secondary">BMP</Badge>
                        </div>
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) handleFileSelect(file)
                        }}
                      />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="relative rounded-xl overflow-hidden border border-border">
                        <img
                          src={vectorizedResult || previewUrl}
                          alt="Preview"
                          className="w-full h-auto max-h-[500px] object-contain bg-muted/30"
                        />
                        <canvas ref={canvasRef} className="hidden" />
                        {isProcessing && (
                          <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                            <div className="text-center">
                              <RefreshCw className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
                              <p className="text-lg font-medium">Vectorizando...</p>
                              <p className="text-sm text-muted-foreground">La IA está trabajando en tu imagen</p>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setSelectedFile(null)
                            setPreviewUrl('')
                            setIsVectorized(false)
                            setVectorizedResult('')
                          }}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Eliminar
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          Cambiar
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card>
                <CardHeader>
                  <CardTitle>Acciones Rápidas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Mode Selector */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Modo de Vectorización</Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={!useAI ? "default" : "outline"}
                        className={`flex-1 gap-2 ${!useAI ? "gradient-primary text-white" : ""}`}
                        onClick={() => setUseAI(false)}
                      >
                        <Zap className="w-4 h-4" />
                        Básico (Gratis)
                      </Button>
                      <Button
                        type="button"
                        variant={useAI ? "default" : "outline"}
                        className={`flex-1 gap-2 ${useAI ? "gradient-primary text-white" : ""}`}
                        onClick={() => setUseAI(true)}
                      >
                        <Sparkles className="w-4 h-4" />
                        IA (Créditos)
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {!useAI
                        ? "Modo básico gratuito. Convierte imágenes a SVG sin IA."
                        : "Modo IA con Replicate. Requiere créditos pero ofrece mejor calidad."}
                    </p>
                  </div>

                  <Separator />

                  <Button
                    className="w-full gap-2 gradient-primary text-white"
                    onClick={handleVectorize}
                    disabled={!selectedFile || isProcessing}
                  >
                    <Sparkles className="w-4 h-4" />
                    {isProcessing ? 'Vectorizando...' : 'Vectorizar Ahora'}
                  </Button>

                  <Separator />

                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => setVectorOptions(prev => ({ ...prev, colorMode: prev.colorMode === 'positive' ? 'negative' : 'positive' }))}
                    disabled={!isVectorized}
                  >
                    <Palette className="w-4 h-4 mr-2" />
                    {vectorOptions.colorMode === 'positive' ? 'Invertir a Negativo' : 'Invertir a Positivo'}
                  </Button>

                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={handleRecognizeFont}
                    disabled={!selectedFile || isChatLoading}
                  >
                    <Type className="w-4 h-4 mr-2" />
                    Reconocer Fuente
                  </Button>

                  <Separator />

                  <div className="space-y-2">
                    <Label>Formato de Exportación</Label>
                    <Select value={exportFormat} onValueChange={(value) => setExportFormat(value as ExportFormat)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="svg">SVG - Vector</SelectItem>
                        <SelectItem value="pdf">PDF - Documento</SelectItem>
                        <SelectItem value="png">PNG - Imagen</SelectItem>
                        <SelectItem value="eps">EPS - Vector</SelectItem>
                        <SelectItem value="dxf">DXF - CAD</SelectItem>
                        <SelectItem value="ai">AI - Adobe Illustrator</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    className="w-full gap-2"
                    onClick={handleExport}
                    disabled={!isVectorized}
                  >
                    <Download className="w-4 h-4" />
                    Exportar {exportFormat.toUpperCase()}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Options Tab */}
          <TabsContent value="options" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    Modo de Vectorización
                  </CardTitle>
                  <CardDescription>
                    Selecciona el modo que mejor se adapte a tu tipo de imagen
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      variant={vectorOptions.mode === 'standard' ? 'default' : 'outline'}
                      className="justify-start gap-2 h-auto p-4"
                      onClick={() => setVectorOptions(prev => ({ ...prev, mode: 'standard' }))}
                    >
                      <Layers className="w-5 h-5" />
                      <div className="text-left">
                        <div className="font-medium">Estándar</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Equilibrado para la mayoría de imágenes
                        </div>
                      </div>
                      {vectorOptions.mode === 'standard' && <Check className="w-4 h-4 ml-auto" />}
                    </Button>

                    <Button
                      variant={vectorOptions.mode === 'artistic' ? 'default' : 'outline'}
                      className="justify-start gap-2 h-auto p-4"
                      onClick={() => setVectorOptions(prev => ({ ...prev, mode: 'artistic' }))}
                    >
                      <Palette className="w-5 h-5" />
                      <div className="text-left">
                        <div className="font-medium">Artístico</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Para ilustraciones y arte
                        </div>
                      </div>
                      {vectorOptions.mode === 'artistic' && <Check className="w-4 h-4 ml-auto" />}
                    </Button>

                    <Button
                      variant={vectorOptions.mode === 'logo' ? 'default' : 'outline'}
                      className="justify-start gap-2 h-auto p-4"
                      onClick={() => setVectorOptions(prev => ({ ...prev, mode: 'logo' }))}
                    >
                      <FileText className="w-5 h-5" />
                      <div className="text-left">
                        <div className="font-medium">Logo</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Optimizado para logos y marcas
                        </div>
                      </div>
                      {vectorOptions.mode === 'logo' && <Check className="w-4 h-4 ml-auto" />}
                    </Button>

                    <Button
                      variant={vectorOptions.mode === 'photo' ? 'default' : 'outline'}
                      className="justify-start gap-2 h-auto p-4"
                      onClick={() => setVectorOptions(prev => ({ ...prev, mode: 'photo' }))}
                    >
                      <ImageIcon className="w-5 h-5" />
                      <div className="text-left">
                        <div className="font-medium">Foto</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Para fotografías realistas
                        </div>
                      </div>
                      {vectorOptions.mode === 'photo' && <Check className="w-4 h-4 ml-auto" />}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Ajustes Avanzados</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <Label>Nivel de Detalle</Label>
                      <Badge variant="outline">{vectorOptions.detailLevel}%</Badge>
                    </div>
                    <Slider
                      value={[vectorOptions.detailLevel]}
                      onValueChange={([value]) => setVectorOptions(prev => ({ ...prev, detailLevel: value }))}
                      max={100}
                      step={5}
                    />
                    <p className="text-xs text-muted-foreground">
                      Mayor detalle = más nodos y curvas, mejor calidad pero archivo más grande
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <Label>Suavizado</Label>
                      <Badge variant="outline">{vectorOptions.smoothness}%</Badge>
                    </div>
                    <Slider
                      value={[vectorOptions.smoothness]}
                      onValueChange={([value]) => setVectorOptions(prev => ({ ...prev, smoothness: value }))}
                      max={100}
                      step={5}
                    />
                    <p className="text-xs text-muted-foreground">
                      Reduce el ruido y suaviza las curvas para resultados más limpios
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <Label>Número de Colores</Label>
                      <Badge variant="outline">{vectorOptions.colorCount}</Badge>
                    </div>
                    <Slider
                      value={[vectorOptions.colorCount]}
                      onValueChange={([value]) => setVectorOptions(prev => ({ ...prev, colorCount: value }))}
                      max={64}
                      step={1}
                    />
                    <p className="text-xs text-muted-foreground">
                      Cantidad máxima de colores en la vectorización
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Opciones Adicionales</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-3 gap-6">
                    <div className="flex items-center justify-between space-x-2">
                      <Label htmlFor="preserve-colors" className="flex flex-col gap-1">
                        <span>Preservar Colores</span>
                        <span className="font-normal text-xs text-muted-foreground">
                          Mantiene los colores originales de la imagen
                        </span>
                      </Label>
                      <Switch
                        id="preserve-colors"
                        checked={vectorOptions.preserveColors}
                        onCheckedChange={(checked) => setVectorOptions(prev => ({ ...prev, preserveColors: checked }))}
                      />
                    </div>

                    <div className="flex items-center justify-between space-x-2">
                      <Label htmlFor="remove-bg" className="flex flex-col gap-1">
                        <span>Eliminar Fondo</span>
                        <span className="font-normal text-xs text-muted-foreground">
                          Elimina el fondo automáticamente con IA
                        </span>
                      </Label>
                      <Switch
                        id="remove-bg"
                        checked={vectorOptions.removeBackground}
                        onCheckedChange={(checked) => setVectorOptions(prev => ({ ...prev, removeBackground: checked }))}
                      />
                    </div>

                    <div className="flex items-center justify-between space-x-2">
                      <Label htmlFor="optimize-print" className="flex flex-col gap-1">
                        <span>Optimizar para Impresión</span>
                        <span className="font-normal text-xs text-muted-foreground">
                          Mejora la calidad para sellos de goma y impresión
                        </span>
                      </Label>
                      <Switch
                        id="optimize-print"
                        checked={vectorOptions.optimizeForPrint}
                        onCheckedChange={(checked) => setVectorOptions(prev => ({ ...prev, optimizeForPrint: checked }))}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Modify Tab */}
          <TabsContent value="modify" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="w-5 h-5" />
                  Modificar con IA
                </CardTitle>
                <CardDescription>
                  Describe los cambios que deseas y la IA los aplicará a tu imagen
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Prompt de Modificación</Label>
                  <Textarea
                    placeholder="Ej: Cambia el fondo a azul, haz el texto más grande, añade un borde decorativo..."
                    className="min-h-[100px]"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="cursor-pointer hover:bg-secondary/80" onClick={() => handleAIModification('Añade un borde decorativo elegante')}>
                    + Borde decorativo
                  </Badge>
                  <Badge variant="secondary" className="cursor-pointer hover:bg-secondary/80" onClick={() => handleAIModification('Haz el texto más grande y legible')}>
                    + Texto más grande
                  </Badge>
                  <Badge variant="secondary" className="cursor-pointer hover:bg-secondary/80" onClick={() => handleAIModification('Simplifica el diseño para sello de goma')}>
                    + Simplificar para sello
                  </Badge>
                  <Badge variant="secondary" className="cursor-pointer hover:bg-secondary/80" onClick={() => handleAIModification('Mejora el contraste y la nitidez')}>
                    + Mejorar contraste
                  </Badge>
                  <Badge variant="secondary" className="cursor-pointer hover:bg-secondary/80" onClick={() => handleAIModification('Convierte a estilo minimalista')}>
                    + Estilo minimalista
                  </Badge>
                  <Badge variant="secondary" className="cursor-pointer hover:bg-secondary/80" onClick={() => handleAIModification('Añade sombras y profundidad')}>
                    + Añadir profundidad
                  </Badge>
                </div>

                <Button
                  className="w-full gap-2 gradient-primary text-white"
                  onClick={() => handleAIModification(chatInput)}
                  disabled={!selectedFile || isProcessing || !chatInput.trim()}
                >
                  <Wand2 className="w-4 h-4" />
                  Aplicar Modificación con IA
                </Button>
              </CardContent>
            </Card>

            {isVectorized && (
              <Card>
                <CardHeader>
                  <CardTitle>Vista Previa</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative rounded-xl overflow-hidden border border-border">
                    <img
                      src={vectorizedResult || previewUrl}
                      alt="Modified preview"
                      className="w-full h-auto max-h-[600px] object-contain bg-muted/30"
                    />
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Chat Tab */}
          <TabsContent value="chat" className="space-y-6">
            <Card className="h-[700px] flex flex-col">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  Asistente de Diseño con IA
                </CardTitle>
                <CardDescription>
                  Pregunta sobre vectorización, diseño, fuentes, optimización para sellos y más
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col min-h-0">
                <ScrollArea className="flex-1 pr-4 custom-scrollbar mb-4">
                  <div className="space-y-4">
                    {chatMessages.map((message, index) => (
                      <div
                        key={index}
                        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                            message.role === 'user'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                          <p className="text-xs opacity-60 mt-2">
                            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    ))}
                    {isChatLoading && (
                      <div className="flex justify-start">
                        <div className="bg-muted rounded-2xl px-4 py-3">
                          <div className="flex gap-1">
                            <div className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" />
                            <div className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce delay-100" />
                            <div className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce delay-200" />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>

                <div className="flex gap-2">
                  <Input
                    placeholder="Escribe tu pregunta sobre diseño o vectorización..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    disabled={isChatLoading}
                  />
                  <Button onClick={handleSendMessage} disabled={isChatLoading || !chatInput.trim()}>
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 mt-auto py-6 bg-background/80 backdrop-blur-lg">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p className="flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Armando's Vector - Vectorización Profesional con IA para Sellos de Goma y Diseño Gráfico
          </p>
          <p className="mt-2">Powered by Advanced AI Technology</p>
        </div>
      </footer>
    </div>
  )
}

function Send({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  )
}
