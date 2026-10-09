import { Sparkles } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {useState} from 'react';
import {useQuery,useMutation} from '@tanstack/react-query';
import {apiRequest,queryClient} from '@/lib/queryClient';
import {Button} from '@/components/ui/button';
import {Textarea} from '@/components/ui/textarea';
import AdminShell from '@/components/AdminShell';
import { ProductsHarness } from '@/features/adminProducts/ProductsHarness';

function BuildRulesEditor(){
  const [draft,setDraft]=useState<string[]|null>(null);
  const [version,setVersion]=useState<number|null>(null);
  const {data,error,isLoading}=useQuery<{rules:string[];version:number;updatedAt:string}>({queryKey:['/api/admin/ai-build-rules']});
  const save=useMutation({mutationFn:async()=>{const r=await apiRequest('PUT','/api/admin/ai-build-rules',{rules:draft,version});return r.json();},
    onSuccess:next=>{queryClient.setQueryData(['/api/admin/ai-build-rules'],next);setDraft(null);setVersion(null);}});
  if(isLoading)return <p>Loading saved instructions…</p>;
  if(error||!data)return <p role="alert">Instructions could not load: {error?.message}</p>;
  const rules=draft??data.rules;
  function change(next:string[]){if(draft===null)setVersion(data!.version);setDraft(next);}
  return <section className="rounded-xl border p-4 space-y-4" aria-label="AI build rules">
    <h2 className="text-lg font-semibold">Saved AI build instructions</h2>
    <p>These saved instructions are used by every new AI build request. Version {data.version}.</p>
    {rules.map((rule,index)=><div key={index} className="space-y-2"><label htmlFor={`ai-rule-${index}`}>Instruction {index+1}</label>
      <Textarea id={`ai-rule-${index}`} value={rule} rows={4} onChange={e=>change(rules.map((r,i)=>i===index?e.target.value:r))}/>
      <Button variant="outline" onClick={()=>change(rules.filter((_,i)=>i!==index))}>Remove instruction {index+1}</Button></div>)}
    <Button variant="outline" onClick={()=>change([...rules,''])}>Add instruction</Button>
    <Button data-testid="button-save-ai-rules" disabled={!draft||save.isPending} onClick={()=>save.mutate()}>Save Instructions</Button>
    {save.error&&<p role="alert">{save.error.message}</p>}
    {save.isSuccess&&!draft&&<p role="status">Instructions saved.</p>}
  </section>;
}
export default function AdminAiBuilder() {
  return <AdminShell title="AI Product Builder" icon={Sparkles}>
    <p className="mb-4 text-sm text-muted-foreground">Choose a product or resume a draft, describe your idea, then review the AI suggestion. Save and Generate use your current product build.</p>
    <Tabs defaultValue="build">
      <TabsList className="mb-4 h-auto w-full">
        <TabsTrigger value="build" className="min-h-12 flex-1">Build</TabsTrigger>
        <TabsTrigger value="rules" className="min-h-12 flex-1">AI Build Rules</TabsTrigger>
      </TabsList>
      <TabsContent value="build" forceMount className="data-[state=inactive]:hidden">
        <ProductsHarness aiBuilder showHeader={false} />
      </TabsContent>
      <TabsContent value="rules">
        <BuildRulesEditor />
      </TabsContent>
    </Tabs>
  </AdminShell>;
}
