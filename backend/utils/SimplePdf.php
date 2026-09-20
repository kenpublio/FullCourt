<?php

/** Lightweight dependency-free PDF writer for branded, text/table reports. */
class SimplePdf {
    private array $pages = [];
    private array $current = [];
    private int $y = 790;

    public function heading(string $organization, string $title, string $subtitle = ''): void {
        if ($this->current) $this->newPage();
        $this->text($organization, 44, $this->y, 16, true, [0.10,0.10,0.11]);
        $this->y -= 26;
        $this->text($title, 44, $this->y, 22, true, [0.97,0.45,0.09]);
        $this->y -= 20;
        if ($subtitle !== '') {$this->text($subtitle,44,$this->y,9,false,[0.35,0.35,0.38]);$this->y-=18;}
        $this->line(44,$this->y,551,$this->y,[0.97,0.45,0.09]);$this->y-=22;
    }

    public function section(string $title): void {
        $this->ensure(40);$this->text($title,44,$this->y,13,true,[0.10,0.10,0.11]);$this->y-=20;
    }

    public function row(array $cells, array $widths, bool $header = false): void {
        $this->ensure(22);$x=44;$size=$header?8:8;
        if($header){$this->rect(42,$this->y-5,510,18,[0.12,0.12,0.13]);}
        foreach($cells as $i=>$cell){$color=$header?[1,1,1]:[0.18,0.18,0.20];$this->text($this->clip((string)$cell,$widths[$i]??80),$x,$this->y,$size,$header,$color);$x+=$widths[$i]??80;}
        $this->y-=18;
        if(!$header)$this->line(44,$this->y+4,551,$this->y+4,[0.88,0.88,0.89]);
    }

    public function paragraph(string $text): void {
        foreach(explode("\n",wordwrap($text,95,"\n",true)) as $line){$this->ensure(14);$this->text($line,44,$this->y,9,false,[0.25,0.25,0.28]);$this->y-=13;}$this->y-=5;
    }

    public function output(): string {
        if($this->current)$this->newPage();
        $objects=[];$fontRegular=1;$fontBold=2;
        $objects[$fontRegular]="<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
        $objects[$fontBold]="<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>";
        $pageIds=[];$contentIds=[];$next=3;
        foreach($this->pages as $page){$contentIds[]=$next++;$pageIds[]=$next++;}
        $pagesId=$next++;$catalogId=$next++;
        foreach($this->pages as $i=>$page){$stream=implode("\n",$page);$objects[$contentIds[$i]]="<< /Length ".strlen($stream)." >>\nstream\n{$stream}\nendstream";$objects[$pageIds[$i]]="<< /Type /Page /Parent {$pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 1 0 R /F2 2 0 R >> >> /Contents {$contentIds[$i]} 0 R >>";}
        $kids=implode(' ',array_map(static fn(int $id):string=>"{$id} 0 R",$pageIds));
        $objects[$pagesId]="<< /Type /Pages /Kids [{$kids}] /Count ".count($pageIds)." >>";
        $objects[$catalogId]="<< /Type /Catalog /Pages {$pagesId} 0 R >>";
        ksort($objects);$pdf="%PDF-1.4\n";$offsets=[0];
        foreach($objects as $id=>$body){$offsets[$id]=strlen($pdf);$pdf.="{$id} 0 obj\n{$body}\nendobj\n";}
        $xref=strlen($pdf);$count=max(array_keys($objects))+1;$pdf.="xref\n0 {$count}\n0000000000 65535 f \n";
        for($i=1;$i<$count;$i++)$pdf.=sprintf('%010d 00000 n ', $offsets[$i]??0)."\n";
        return $pdf."trailer\n<< /Size {$count} /Root {$catalogId} 0 R >>\nstartxref\n{$xref}\n%%EOF";
    }

    private function newPage():void{$number=count($this->pages)+1;$this->text("FullCourt | Page {$number}",44,24,7,false,[0.45,0.45,0.48]);$this->pages[]=$this->current;$this->current=[];$this->y=790;}
    private function ensure(int $height):void{if($this->y-$height<45)$this->newPage();}
    private function text(string $text,float $x,float $y,int $size,bool $bold,array $color):void{$escaped=str_replace(['\\','(',')'],['\\\\','\\(','\\)'],$this->ascii($text));$font=$bold?'F2':'F1';$this->current[]=sprintf('BT %.2F %.2F %.2F rg /%s %d Tf %.1F %.1F Td (%s) Tj ET',$color[0],$color[1],$color[2],$font,$size,$x,$y,$escaped);}
    private function line(float $x1,float $y1,float $x2,float $y2,array $color):void{$this->current[]=sprintf('%.2F %.2F %.2F RG %.1F %.1F m %.1F %.1F l S',$color[0],$color[1],$color[2],$x1,$y1,$x2,$y2);}
    private function rect(float $x,float $y,float $w,float $h,array $color):void{$this->current[]=sprintf('%.2F %.2F %.2F rg %.1F %.1F %.1F %.1F re f',$color[0],$color[1],$color[2],$x,$y,$w,$h);}
    private function clip(string $text,int $width):string{$limit=max(5,(int)floor($width/4.7));return strlen($text)>$limit?substr($text,0,$limit-3).'...':$text;}
    private function ascii(string $text):string{return preg_replace('/[^\x20-\x7E]/','-',str_replace(['–','—','·'],['-','-',' | '],$text))??'';}
}
