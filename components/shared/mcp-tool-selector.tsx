'use client'

import { useState, useEffect, useCallback } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'

interface McpToolInfo {
  id: string
  code: string
  name: string
  description: string | null
  executionType: string | null
  serverId: string | null
  serverName: string | null
}

interface McpToolSelectorProps {
  value?: string
  onChange: (toolCode: string, tool?: McpToolInfo) => void
  agentType?: string
  allowedToolIds?: string[]
  placeholder?: string
  disabled?: boolean
}

export function McpToolSelector({
  value,
  onChange,
  agentType,
  allowedToolIds,
  placeholder = 'Select MCP tool...',
  disabled = false,
}: McpToolSelectorProps) {
  const [open, setOpen] = useState(false)
  const [tools, setTools] = useState<McpToolInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  const fetchTools = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (agentType) params.set('agentType', agentType)

      const res = await fetch(`/api/mcp/tools?${params}`)
      const json = await res.json()
      let fetched = (json.data || []) as McpToolInfo[]

      if (allowedToolIds?.length) {
        const allowed = new Set(allowedToolIds)
        fetched = fetched.filter(t => allowed.has(t.id))
      }

      setTools(fetched)
    } catch {
      setTools([])
    } finally {
      setLoading(false)
    }
  }, [agentType, allowedToolIds])

  useEffect(() => {
    fetchTools()
  }, [fetchTools])

  const selected = tools.find(t => t.code === value || t.name === value)

  const filtered = search
    ? tools.filter(t =>
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.code?.toLowerCase().includes(search.toLowerCase()) ||
        t.description?.toLowerCase().includes(search.toLowerCase())
      )
    : tools

  return (
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        role="combobox"
        disabled={disabled}
        className={cn('w-full justify-between', !selected && 'text-muted-foreground')}
        onClick={() => setOpen(!open)}
      >
        {selected ? `${selected.name} (${selected.code})` : placeholder}
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md">
            <div className="p-2">
              <input
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="Search tools..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <ScrollArea className="h-72">
              {loading ? (
                <div className="p-4 text-sm text-muted-foreground text-center">Loading...</div>
              ) : filtered.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground text-center">
                  {search ? 'No tools found' : 'No tools available'}
                </div>
              ) : (
                filtered.map(tool => (
                  <button
                    key={tool.id}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                    onClick={() => {
                      onChange(tool.code || tool.name, tool)
                      setOpen(false)
                      setSearch('')
                    }}
                  >
                    <Check
                      className={cn(
                        'h-4 w-4 shrink-0',
                        (value === tool.code || value === tool.name) ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <div className="flex flex-col items-start text-left">
                      <span>{tool.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {tool.code} {tool.executionType ? `· ${tool.executionType}` : ''}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </ScrollArea>
            {!loading && tools.length === 0 && (
              <div className="border-t p-3 text-xs text-muted-foreground text-center">
                No MCP tools permitted for this configuration.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
