# Cliente Flutter

O código móvel usa a mesma API do backend. Para gerar as plataformas ausentes nesta cópia do projeto, instale o Flutter e execute `flutter create .` dentro desta pasta.

Depois, adicione as permissões de câmara e localização aos manifests Android/iOS gerados e execute:

```powershell
flutter pub get
flutter run --dart-define=API_BASE=http://IP_DO_COMPUTADOR:3000
```

No emulador Android, o valor habitual de `API_BASE` é `http://10.0.2.2:3000`.
