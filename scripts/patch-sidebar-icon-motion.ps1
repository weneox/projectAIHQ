param(
  [ValidateSet("soft", "lift", "tilt", "slide", "press", "glow", "none")]
  [string]$Variant = "soft"
)

$sidebarPath = ".\ai-hq-frontend\src\components\layout\Sidebar.jsx"

if (!(Test-Path $sidebarPath)) {
  throw "Sidebar.jsx tapilmadi: $sidebarPath"
}

$backupPath = "$sidebarPath.before-icon-motion"

if (!(Test-Path $backupPath)) {
  Copy-Item $sidebarPath $backupPath
  Write-Host "Backup yaradildi: $backupPath"
}

$content = Get-Content $sidebarPath -Raw

$motionClasses = @{
  soft  = "transition-[color,transform,filter] duration-slow ease-premium group-hover:-translate-y-px group-hover:scale-[1.055]"
  lift  = "transition-[color,transform,filter] duration-slow ease-premium group-hover:-translate-y-[2px] group-hover:scale-[1.09]"
  tilt  = "transition-[color,transform,filter] duration-slow ease-premium group-hover:-rotate-6 group-hover:scale-[1.08]"
  slide = "transition-[color,transform,filter] duration-slow ease-premium group-hover:translate-x-[2px] group-hover:scale-[1.045]"
  press = "transition-[color,transform,filter] duration-base ease-premium group-hover:scale-[0.92]"
  glow  = "transition-[color,transform,filter] duration-slow ease-premium group-hover:scale-[1.065] group-hover:drop-shadow-[0_8px_12px_rgba(46,96,255,0.24)]"
  none  = "transition-colors duration-base ease-premium"
}

$iconMotionClass = $motionClasses[$Variant]

$newFunction = @"
function SidebarVectorIcon({ Icon, isActive = false }) {
  if (!Icon) return null;

  return (
    <span className="relative z-[2] flex h-6 w-6 shrink-0 items-center justify-center">
      <Icon
        className={cx(
          "block h-[21px] w-[21px] shrink-0 $iconMotionClass",
          isActive ? "text-brand" : "text-text-subtle group-hover:text-text"
        )}
        strokeWidth={1.95}
      />
    </span>
  );
}

"@

$start = $content.IndexOf("function SidebarVectorIcon")
$end = $content.IndexOf("function SidebarItem")

if ($start -lt 0 -or $end -lt 0 -or $end -le $start) {
  Write-Host "SidebarVectorIcon ve ya SidebarItem tapilmadi. Faylda axtaris neticesi:"
  Select-String -Path $sidebarPath -Pattern "SidebarVectorIcon|SidebarImageIcon|function SidebarItem|function Sidebar" -Context 1,3
  throw "Patch dayandi."
}

$content = $content.Substring(0, $start) + $newFunction + $content.Substring($end)

[System.IO.File]::WriteAllText(
  (Resolve-Path $sidebarPath),
  $content,
  [System.Text.UTF8Encoding]::new($false)
)

Write-Host "Sidebar icon motion variant tetbiq olundu: $Variant"