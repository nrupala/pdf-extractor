[Setup]
AppName=PDF Extractor
AppVersion=1.0.0
DefaultDirName={autopf}\PDF Extractor
OutputBaseFilename=pdfx-setup
[Files]
Source: "..\dist\pdfx.exe"; DestDir: "{app}"; Flags: ignoreversion
[Icons]
Name: "{autoprograms}\PDF Extractor"; Filename: "{app}\pdfx.exe"
