# AI Task Orchestrator

AI Task Orchestrator, VS Code icinde fikir veya gorev metnini parcalayip task planina, prompt taslaklarina, onay akisina ve sirali prompt kuyruguna donusturmeyi hedefleyen erken asama bir VS Code Extension projesidir.

Bu repo su anda Marketplace'te yayinlanmis bir extension degildir. Yerel gelistirme ve test amaciyla calistirilir.

## Temel Ozellikler

- VS Code sidebar ve webview panel arayuzu.
- Fikir/gorev metninden task plani uretme.
- OpenAI, Gemini veya Mock provider secimi.
- Provider yoksa deterministic local planning fallback.
- Task bazli prompt uretimi.
- Prompt taslaklarini onaylama veya reddetme.
- Onayli promptlari sirali kuyrukta calistirma.
- Manual/external prompt akisinda kopyalama, manuel tamamlama ve cancel destegi.
- Riskli aksiyonlar icin approval modeli.
- JSON tabanli lokal state saklama.
- Kritik guvenlik/stabilite alanlari icin minimal regresyon testleri.

## Kullanilan Teknolojiler

- TypeScript
- VS Code Extension API
- VS Code Webview
- Node.js
- Zod
- OpenAI Chat Completions API uyumlu provider katmani
- Gemini Generate Content API uyumlu provider katmani
- Node built-in `node:test` test runner

## Mimari Genel Bakis

Ana extension giris noktasi `src/extension.ts` dosyasidir. Burada komutlar ve sidebar provider kaydedilir.

Yuksek seviyeli akis:

1. `src/webview/SidebarViewProvider.ts` sidebar gorunumunu olusturur.
2. `src/webview/WebviewPanelController.ts` webview panel ile extension backend arasindaki mesajlasmayi yonetir.
3. `src/core/orchestrator/Orchestrator.ts` uygulama akislarini koordine eder.
4. `src/core/orchestrator/TaskPlanner.ts` kullanici girdisinden task plani uretir.
5. `src/core/orchestrator/PromptGenerator.ts` tasklardan prompt taslaklari uretir.
6. `src/core/orchestrator/PromptQueueManager.ts` prompt durum gecislerini ve kuyruk calismasini yonetir.
7. `src/providers/*` OpenAI, Gemini ve Mock provider soyutlamasini icerir.
8. `src/services/approval/ApprovalManager.ts` riskli aksiyonlar icin approval kararlarini yonetir.
9. `src/services/action/ActionEngine.ts` kontrollu dosya/aksiyon islemlerini yurutur.
10. `src/store/JsonStateManager.ts` state'i workspace altindaki `.vscode/ai-orchestrator-state.json` dosyasinda saklar.

## Kurulum

Gereksinimler:

- Node.js
- npm
- VS Code

PowerShell uzerinden:

```powershell
npm.cmd install
npm.cmd run compile
```

PowerShell execution policy nedeniyle `npm run ...` yerine `npm.cmd ...` kullanmak daha sorunsuz olabilir.

## VS Code Extension Olarak Calistirma

1. Projeyi VS Code ile acin.
2. Terminalde derlemenin gectigini dogrulayin:

```powershell
npm.cmd run compile
```

3. VS Code Run and Debug panelinden `Run Extension` konfigurasyonunu secin.
4. `F5` tusuna basin.
5. Acilan Extension Development Host penceresinde:
    - Explorer sidebar icinde `AI Task Orchestrator` view'unu acin.
    - Ya da Command Palette uzerinden `AI Task Orchestrator: Open Panel` komutunu calistirin.

## Provider Yapisi

Extension uc provider modunu destekler:

- `openai`: OpenAI API key gerektirir.
- `gemini`: Gemini API key gerektirir.
- `mock`: Gercek API cagrisina ihtiyac duymadan simule provider ile calisir.

Provider secimi VS Code settings icinden yapilir:

```json
{
    "aiTaskOrchestrator.provider": "mock"
}
```

Model ve timeout ayarlari:

```json
{
    "aiTaskOrchestrator.openAiModel": "gpt-4o-mini",
    "aiTaskOrchestrator.geminiModel": "gemini-1.5-flash",
    "aiTaskOrchestrator.timeoutMs": 30000,
    "aiTaskOrchestrator.maxRetries": 2
}
```

## API Key Guvenligi

API key degerlerini kaynak koda veya repoya yazmayin.

Extension API key saklamak icin VS Code SecretStorage kullanir. Komutlar:

- `AI Task Orchestrator: Set OpenAI API Key`
- `AI Task Orchestrator: Set Gemini API Key`

Gelistirme ortaminda environment variable fallback'i de desteklenir:

```powershell
$env:OPENAI_API_KEY="your-openai-api-key"
$env:GEMINI_API_KEY="your-gemini-api-key"
```

Bu degerler ornek placeholder'dir; gercek secret degerlerini commit etmeyin. `.env` dosyalari `.gitignore` ile disarida birakilmistir.

## Test Komutlari

TypeScript derleme:

```powershell
npm.cmd run compile
```

Regresyon testleri:

```powershell
npm.cmd test
```

Mevcut testler su alanlari kapsar:

- `ActionEngine.resolvePath` workspace disina kacis kontrolleri.
- `PromptQueueManager` manual prompt beklerken cancel akisi.
- `JsonStateManager.replaceTasks` orphan prompt temizligi.
- `Orchestrator.generateAllPrompts` duplicate prompt engeli.

Not: Bazi sandbox ortamlarda Node test runner child process baslatirken izin hatasi verebilir. Normal yerel terminalde `npm.cmd test` calismalidir.

## VSIX Paketleme

Yerel VSIX paketi olusturmak icin:

```powershell
npm.cmd run package
```

Bu komut `vsce package` calistirir ve Marketplace'e yayinlama yapmaz. Yayinlama icin ayrica gercek bir VS Code Marketplace publisher hesabinin hazirlanmasi gerekir.

## Bilinen Sinirliliklar

- Extension henuz Marketplace'te yayinlanmis degildir.
- UI icin otomatik E2E test yoktur.
- Webview tarafinda manuel smoke test gereklidir.
- AI provider hatalari temel mesajlarla gosterilir; daha zengin hata siniflandirmasi ileride gelistirilebilir.
- State lokal workspace altinda JSON dosyasi olarak tutulur; cok kullanicili veya remote senaryolar icin tasarlanmamistir.
- Terminal komutu, diff uygulama, dosya silme gibi yuksek riskli aksiyonlar ilk surumde kontrollu/deferred davranir.
- Bazi metinlerde encoding kaynakli Turkce karakter problemleri gorulebilir; smoke test checklist bunu ozellikle kontrol eder.

## Gelistirme Yol Haritasi

- Webview UI icin smoke test otomasyonu veya VS Code extension integration testleri eklemek.
- Provider health check sonucunu UI'da daha acik gostermek.
- Prompt queue icin internal AI basari/hata testlerini genisletmek.
- Approval akisinda daha ayrintili risk siniflandirmasi yapmak.
- README ve docs altina gelistirici troubleshooting bolumu eklemek.
- Paketleme ve release adimlarini ayri bir dokumanla netlestirmek.

## Manuel Smoke Test

Manuel dogrulama icin [docs/smoke-test-checklist.md](docs/smoke-test-checklist.md) dosyasini takip edin.
