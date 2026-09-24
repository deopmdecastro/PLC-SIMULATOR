$ErrorActionPreference = 'Continue'

$S7Bit = 1
$S7Word = 3

$sim = New-Object -ComObject 'S7wspsmx.S7ProSim'
$connect = $sim.Connect()
Write-Host "Connect=$connect"

$state = $sim.GetState()
Write-Host "State=$state"

$q00 = $false
$resultQ = $sim.ReadOutputPoint(0, 0, $S7Bit, [ref]$q00)
Write-Host "Read Q0.0 result=$resultQ value=$q00"

$q01 = $false
$resultQ1 = $sim.ReadOutputPoint(0, 1, $S7Bit, [ref]$q01)
Write-Host "Read Q0.1 result=$resultQ1 value=$q01"

[int16]$mw100 = 0
$resultMw = $sim.ReadFlagValue(100, 0, $S7Word, [ref]$mw100)
Write-Host "Read MW100 result=$resultMw value=$mw100"

foreach ($typeCode in 0..10) {
  try {
    [int16]$typedValue = 0
    $typedResult = $sim.ReadFlagValue(100, 0, $typeCode, [ref]$typedValue)
    Write-Host "ReadFlagValue type=$typeCode int16 result=$typedResult value=$typedValue"
  } catch {
    Write-Host "ReadFlagValue type=$typeCode int16 ERROR $($_.Exception.Message)"
  }
}

[int16]$writeValue = 7
$writeResult = $sim.WriteFlagValue(100, 0, $writeValue)
Write-Host "Write MW100=7 result=$writeResult"

Start-Sleep -Milliseconds 300

[int16]$mw100After = 0
$resultMwAfter = $sim.ReadFlagValue(100, 0, $S7Word, [ref]$mw100After)
Write-Host "Read MW100 after write result=$resultMwAfter value=$mw100After"

[int16]$restoreValue = 1
$restoreResult = $sim.WriteFlagValue(100, 0, $restoreValue)
Write-Host "Restore MW100=1 result=$restoreResult"

$sim.Disconnect()
