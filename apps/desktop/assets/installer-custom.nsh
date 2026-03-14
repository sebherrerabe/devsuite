!include "nsDialogs.nsh"
!include "LogicLib.nsh"

!ifndef BUILD_UNINSTALLER
Var DevSuiteStartWithWindowsCheckbox
Var DevSuiteStartWithWindowsValue

!macro devsuiteDetectStartupPreference
  StrCpy $DevSuiteStartWithWindowsValue "1"
  ReadRegStr $0 HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "DevSuite"

  ${If} $0 == ""
    StrCpy $DevSuiteStartWithWindowsValue "1"
  ${Else}
    StrCpy $DevSuiteStartWithWindowsValue "1"
  ${EndIf}
!macroend

!macro customInit
  !insertmacro devsuiteDetectStartupPreference
!macroend

!macro customPageAfterChangeDir
  Page custom devsuiteStartupPageCreate devsuiteStartupPageLeave
!macroend

Function devsuiteStartupPageCreate
  !insertmacro devsuiteDetectStartupPreference

  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0 0 100% 14u "Startup Behavior"
  Pop $0
  ${NSD_CreateCheckbox} 0 22u 100% 12u "Start DevSuite when I sign in to Windows"
  Pop $DevSuiteStartWithWindowsCheckbox
  ${NSD_CreateLabel} 0 42u 100% 40u "DevSuite installs a privileged helper for website blocking during focus sessions. This installer-time permission avoids repeated prompts when starting or stopping sessions."
  Pop $0

  ${If} $DevSuiteStartWithWindowsValue == "1"
    ${NSD_Check} $DevSuiteStartWithWindowsCheckbox
  ${Else}
    ${NSD_Uncheck} $DevSuiteStartWithWindowsCheckbox
  ${EndIf}

  nsDialogs::Show
FunctionEnd

Function devsuiteStartupPageLeave
  ${NSD_GetState} $DevSuiteStartWithWindowsCheckbox $0
  ${If} $0 == ${BST_CHECKED}
    StrCpy $DevSuiteStartWithWindowsValue "1"
  ${Else}
    StrCpy $DevSuiteStartWithWindowsValue "0"
  ${EndIf}
FunctionEnd

!macro customInstall
  ${If} $DevSuiteStartWithWindowsValue == "1"
    WriteRegStr SHELL_CONTEXT "Software\Microsoft\Windows\CurrentVersion\Run" "DevSuite" "$\"$appExe$\""
  ${Else}
    DeleteRegValue SHELL_CONTEXT "Software\Microsoft\Windows\CurrentVersion\Run" "DevSuite"
  ${EndIf}
!macroend
!endif

!macro customUnInstall
  DeleteRegValue SHELL_CONTEXT "Software\Microsoft\Windows\CurrentVersion\Run" "DevSuite"
!macroend
