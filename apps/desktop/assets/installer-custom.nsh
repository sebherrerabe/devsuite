!include "nsDialogs.nsh"
!include "LogicLib.nsh"

!define DEVSUITE_HOSTS_HELPER_TASK "DevSuiteHostsWriteHelper"
!define DEVSUITE_HOSTS_HELPER_DIR "$WINDIR\..\ProgramData\DevSuite\hosts-helper"
!define DEVSUITE_HOSTS_HELPER_SCRIPT "$INSTDIR\resources\assets\hosts-write-helper.ps1"

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

  CreateDirectory "${DEVSUITE_HOSTS_HELPER_DIR}"
  ExecWait 'icacls "${DEVSUITE_HOSTS_HELPER_DIR}" /grant "*S-1-5-32-545:(OI)(CI)M" /T /C' $0
  ${If} $0 != 0
    DetailPrint "DevSuite hosts helper directory permission grant exited with code $0"
  ${EndIf}

  IfFileExists "${DEVSUITE_HOSTS_HELPER_SCRIPT}" 0 helperScriptMissing
    ExecWait 'schtasks /Create /TN "${DEVSUITE_HOSTS_HELPER_TASK}" /TR "powershell.exe -NoProfile -ExecutionPolicy Bypass -File $\"${DEVSUITE_HOSTS_HELPER_SCRIPT}$\"" /SC ONCE /ST 00:00 /RL HIGHEST /RU SYSTEM /F' $0
    ${If} $0 != 0
      DetailPrint "Failed to create DevSuite hosts helper task. Exit code: $0"
    ${EndIf}
    Goto helperInstallDone
  helperScriptMissing:
    DetailPrint "DevSuite hosts helper script is missing. Reinstall may be required for hosts enforcement."
  helperInstallDone:
!macroend
!endif

!macro customUnInstall
  DeleteRegValue SHELL_CONTEXT "Software\Microsoft\Windows\CurrentVersion\Run" "DevSuite"
  ExecWait 'schtasks /Delete /TN "${DEVSUITE_HOSTS_HELPER_TASK}" /F' $0
  ${If} $0 != 0
    DetailPrint "Failed to delete DevSuite hosts helper task. Exit code: $0"
  ${EndIf}
  RMDir /r "${DEVSUITE_HOSTS_HELPER_DIR}"
!macroend
