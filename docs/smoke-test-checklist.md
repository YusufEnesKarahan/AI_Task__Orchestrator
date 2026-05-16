# Manual Smoke Test Checklist

Bu checklist, AI Task Orchestrator extension'inin yerel VS Code Extension Development Host ortaminda temel akislarini dogrulamak icin kullanilir.

Testlerden once:

```powershell
npm.cmd install
npm.cmd run compile
```

Regresyon testlerini calistirmak icin:

```powershell
npm.cmd test
```

## 1. Extension Host

- [ ] VS Code Run and Debug panelinde `Run Extension` secili.
- [ ] `F5` ile Extension Development Host penceresi aciliyor.
- [ ] Extension Host acilirken hata bildirimi gorunmuyor.
- [ ] Developer Tools console'da extension aktivasyonuna ait kritik hata yok.

## 2. Sidebar ve Webview Panel

- [ ] Explorer sidebar altinda `AI Task Orchestrator` view'u gorunuyor.
- [ ] Sidebar icindeki `Open Webview Panel` butonu paneli aciyor.
- [ ] Command Palette uzerinden `AI Task Orchestrator: Open Panel` komutu paneli aciyor.
- [ ] Panel kapatilip tekrar acildiginda extension crash etmiyor.

## 3. Turkce Karakter ve UI Gorunumu

- [ ] Panelde Turkce karakterler okunabilir gorunuyor.
- [ ] Bozuk encoding gorunen alan varsa not aliniyor.
- [ ] Ana butonlar ve form alanlari dar/genis pencerede tasma yapmiyor.
- [ ] Provider durum mesaji gorunuyor.

## 4. Mock Provider ile Temel Akis

VS Code settings icinde provider'i mock yapin:

```json
{
    "aiTaskOrchestrator.provider": "mock"
}
```

- [ ] Extension Host yeniden yuklendikten sonra provider durumu mock modu gosteriyor.
- [ ] API key gerektirmeden task/prompt akisi denenebiliyor.

## 5. Task Plani Olusturma

Ornek girdi:

```text
Kullanici girisi olan bir auth modulu ekle. Login, token dogrulama, hata mesajlari ve temel testler olsun.
```

- [ ] Fikir/istek alani dolduruluyor.
- [ ] `Fikirden Prompt Uret` butonuna basiliyor.
- [ ] Task listesi olusuyor.
- [ ] En az bir task secilebilir gorunuyor.
- [ ] Log alaninda task uretimine dair bilgi gorunuyor.

## 6. Prompt Uretimi

- [ ] Olusan task icin prompt taslagi gorunuyor.
- [ ] Prompt queue alaninda draft promptlar listeleniyor.
- [ ] Ayni task icin tekrar prompt uretimi duplicate kayit olusturmuyor.
- [ ] Prompt icerigi bos degil.

## 7. Prompt Approval ve Queue Akisi

- [ ] Draft prompt `Onayla` butonu ile approved duruma geciyor.
- [ ] `Tumunu Onayla` butonu draft promptlari onaylayabiliyor.
- [ ] `Tumunu Reddet` butonu draft promptlari reddedebiliyor.
- [ ] `Onaylilari Kuyruga Al` butonu queue akisini baslatiyor.
- [ ] Provider yoksa veya hata varsa kullaniciya anlasilir hata/log mesaji gorunuyor.

## 8. Queue Cancel Akisi

Manual veya external prompt akisinda:

- [ ] Prompt `ready_for_manual_send` benzeri bekleme durumuna gecebiliyor.
- [ ] `Kuyrugu Iptal Et` butonu gorunuyor.
- [ ] Cancel sonrasi queue takili kalmiyor.
- [ ] Bekleyen prompt `cancelled` statusune gecebildigi dogrulaniyor.
- [ ] Panel tekrar render edildiginde durum tutarli kaliyor.

## 9. Manual Approval Akisi

- [ ] Bir task seciliyor.
- [ ] `Approval Simule Et` butonu calistiriliyor.
- [ ] Approval listesinde bekleyen islem gorunuyor.
- [ ] `Onayla` ile approval approved duruma geciyor.
- [ ] `Reddet` ile approval rejected duruma geciyor.
- [ ] Reddedilen islem icin log veya sonuc mesaji kullaniciya anlasilir sekilde gorunuyor.

## 10. API Key ve SecretStorage

Gercek API key yazmadan komutlarin acildigini dogrulayin:

- [ ] Command Palette icinde `AI Task Orchestrator: Set OpenAI API Key` komutu gorunuyor.
- [ ] Command Palette icinde `AI Task Orchestrator: Set Gemini API Key` komutu gorunuyor.
- [ ] Input password modunda aciliyor.
- [ ] Bos deger girilirse key kaydedilmedigine dair uyari gorunuyor.

Gercek API key kullanilacaksa:

- [ ] Key kaynak koda yazilmiyor.
- [ ] Key README, test veya log dosyasina eklenmiyor.
- [ ] `.env` dosyasi commit edilmiyor.

## 11. Hata Mesajlari

- [ ] Bos fikir/gorev metni ile denendiginde kullaniciya hata/log mesaji gorunuyor.
- [ ] Provider secili ama API key yoksa provider durumu kullaniciya acik mesaj veriyor.
- [ ] Hatalar panelin tamamen crash etmesine neden olmuyor.
- [ ] Webview console'da renderState sirasinda beklenmeyen hata yok.

## 12. Test Sonucu Kaydi

Manuel smoke test sonucu:

- Tarih:
- VS Code surumu:
- Node.js surumu:
- Provider modu:
- Sonuc: Pass / Fail
- Notlar:
