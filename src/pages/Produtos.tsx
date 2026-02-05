 import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
 import { ProdutosCatalogo } from "./produtos/ProdutosCatalogo";
 import { ProdutosEstoque } from "./produtos/ProdutosEstoque";
 import { ProdutosVendas } from "./produtos/ProdutosVendas";
 
 export default function Produtos() {
   return (
     <div className="space-y-6">
       <header className="space-y-1">
         <h1 className="text-2xl font-semibold tracking-tight">Produtos</h1>
         <p className="text-sm text-muted-foreground">Gerencie produtos, estoque e vendas</p>
       </header>
 
       <Tabs defaultValue="catalogo" className="space-y-4">
         <TabsList>
           <TabsTrigger value="catalogo">Catálogo</TabsTrigger>
           <TabsTrigger value="estoque">Estoque (Baixas)</TabsTrigger>
           <TabsTrigger value="vendas">Vendas</TabsTrigger>
         </TabsList>
 
         <TabsContent value="catalogo">
           <ProdutosCatalogo />
         </TabsContent>
 
         <TabsContent value="estoque">
           <ProdutosEstoque />
         </TabsContent>
 
         <TabsContent value="vendas">
           <ProdutosVendas />
         </TabsContent>
       </Tabs>
     </div>
   );
 }