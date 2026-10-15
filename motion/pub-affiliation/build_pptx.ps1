# Construit AMAZER-Pub-Affiliation.pptx avec PowerPoint (COM) :
#  diapo 1 = la pub (video plein ecran, lecture automatique, passage auto apres 30 s)
#  diapo 2 = image de fin (visuel reutilisable)
$ErrorActionPreference = "Stop"
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$video = Join-Path $dir "amazer-pub-affiliation.mp4"
$poster = Join-Path $dir "poster.png"
$endcard = Join-Path $dir "endcard.png"
$out = Join-Path $dir "AMAZER-Pub-Affiliation.pptx"

$app = New-Object -ComObject PowerPoint.Application
$pres = $app.Presentations.Add(0)            # sans fenetre
$pres.PageSetup.SlideWidth = 960
$pres.PageSetup.SlideHeight = 540

# Diapo 1 : la video
$s1 = $pres.Slides.Add(1, 12)                # ppLayoutBlank
$s1.FollowMasterBackground = 0
$s1.Background.Fill.ForeColor.RGB = 0x20120B # #0B1220 (BGR)
$v = $s1.Shapes.AddMediaObject2($video, 0, -1, 0, 0, 960, 540)
$v.Name = "Pub AMAZER Affiliation"
$v.MediaFormat.SetDisplayPictureFromFile($poster)
$null = $s1.TimeLine.MainSequence.AddEffect($v, 83, 0, 2)   # msoAnimEffectMediaPlay, avec la precedente
$s1.SlideShowTransition.AdvanceOnClick = -1
$s1.SlideShowTransition.AdvanceOnTime = -1
$s1.SlideShowTransition.AdvanceTime = 30.5

# Diapo 2 : visuel de fin
$s2 = $pres.Slides.Add(2, 12)
$null = $s2.Shapes.AddPicture($endcard, 0, -1, 0, 0, 960, 540)
$s2.SlideShowTransition.EntryEffect = 1793   # ppEffectFade

$pres.SaveAs($out, 24)                       # ppSaveAsOpenXMLPresentation
$pres.Close()
$app.Quit()
"OK $out"
