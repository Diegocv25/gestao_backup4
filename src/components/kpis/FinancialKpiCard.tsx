 import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
 import { cn } from "@/lib/utils";
 
 interface FinancialKpiCardProps {
   title: string;
   value: string;
   subtitle?: string;
   highlight?: boolean;
   className?: string;
 }
 
 export function FinancialKpiCard({
   title,
   value,
   subtitle,
   highlight = false,
   className,
 }: FinancialKpiCardProps) {
   return (
     <Card
       className={cn(
         "h-full",
         highlight && "border-primary/40 bg-primary/5",
         className
       )}
     >
       <CardHeader className="pb-2">
         <CardTitle className="text-sm font-medium text-muted-foreground">
           {title}
         </CardTitle>
       </CardHeader>
       <CardContent>
         <div className="text-2xl font-semibold tracking-tight">{value}</div>
         {subtitle && (
           <div className="mt-1 text-xs text-muted-foreground">{subtitle}</div>
         )}
       </CardContent>
     </Card>
   );
 }