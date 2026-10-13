import { ChevronDown, Code2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  CodeBlock,
  CodeBlockHeader,
  CodeBlockCopyButton,
} from "@/components/ai-elements/code-block";

export function PineCodeCard({ code, onEdit }: { code: string; onEdit: () => void }) {
  return (
    <Collapsible
      className="mt-3 overflow-hidden rounded-md border border-border"
      defaultOpen={false}
    >
      <div className="flex items-center px-2 py-1">
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 justify-start gap-2 text-xs text-muted-foreground"
          >
            <Code2 />
            <span>Pine Script</span>
            <ChevronDown className="ml-auto size-3" />
          </Button>
        </CollapsibleTrigger>
        <Button variant="ghost" size="sm" onClick={onEdit} className="text-xs">
          <Pencil className="size-3" />
          Edit
        </Button>
      </div>
      <CollapsibleContent>
        <CodeBlock
          code={code}
          language="text"
          showLineNumbers
          className="max-h-80 rounded-none border-0 bg-background text-xs"
        >
          <CodeBlockHeader className="bg-card">
            <span>indicator.pine</span>
            <CodeBlockCopyButton className="h-7 w-auto px-2 text-xs" aria-label="Copy Pine">
              <span>Copy Pine</span>
            </CodeBlockCopyButton>
          </CodeBlockHeader>
        </CodeBlock>
      </CollapsibleContent>
    </Collapsible>
  );
}
