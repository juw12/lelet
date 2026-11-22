; Lelet for Windows - per-user installer (no admin rights). build.py compiles it with:
;   iscc /DAppVersion=1.0.0 /DSourceDir=<dist\Lelet> /DOutputDir=<dist> /DIconFile=<build\lelet.ico> lelet.iss
; Installs to %LOCALAPPDATA%\Programs\Lelet, adds Lelet to the Start menu (and optionally the desktop) and lists it
; in Settings > Apps. The window keeps its data (what you saved in it) in %LOCALAPPDATA%\Lelet, which
; uninstalling leaves in place so a reinstall finds it again.

#ifndef AppVersion
  #define AppVersion "1.0.0"
#endif
#ifndef SourceDir
  #define SourceDir "dist\Lelet"
#endif
#ifndef OutputDir
  #define OutputDir "dist"
#endif
#ifndef IconFile
  #define IconFile "build\lelet.ico"
#endif

[Setup]
AppId={{E81247BA-698B-569E-A6DE-E1E1C366EEFB}
AppName=Lelet
AppVersion={#AppVersion}
AppVerName=Lelet {#AppVersion}
AppPublisher=Juwen Lie
AppPublisherURL=https://juw12.github.io/lelet/
AppSupportURL=https://github.com/juw12/lelet
DefaultDirName={autopf}\Lelet
DisableDirPage=yes
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir={#OutputDir}
OutputBaseFilename=Lelet-Windows-Setup
SetupIconFile={#IconFile}
UninstallDisplayIcon={app}\Lelet.exe
UninstallDisplayName=Lelet
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
CloseApplications=no
SetupLogging=yes

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Files]
Source: "{#SourceDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{userprograms}\Lelet"; Filename: "{app}\Lelet.exe"; Comment: "Ukur kecepatan internet, bandingkan dengan paket yang Anda bayar"
Name: "{userdesktop}\Lelet"; Filename: "{app}\Lelet.exe"; Comment: "Ukur kecepatan internet, bandingkan dengan paket yang Anda bayar"; Tasks: desktopicon

[Run]
Filename: "{app}\Lelet.exe"; Description: "{cm:LaunchProgram,Lelet}"; Flags: nowait postinstall skipifsilent

[UninstallRun]
Filename: "{app}\Lelet.exe"; Parameters: "--stop"; Flags: runhidden waituntilterminated; RunOnceId: "StopLelet"

[Code]
function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  ResultCode: Integer;
begin
  Result := '';
  { Updating: close an open Lelet window first so its files can be replaced. }
  if FileExists(ExpandConstant('{app}\Lelet.exe')) then
    Exec(ExpandConstant('{app}\Lelet.exe'), '--stop', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
end;
