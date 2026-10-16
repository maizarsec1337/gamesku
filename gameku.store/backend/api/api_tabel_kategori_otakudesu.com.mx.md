# TABEL API KATEGORI — https://otakudesu.com.mx

Snapshot: 2026-09-05 · 227 seri anime · 2326 episode
Semua endpoint **tanpa auth / tanpa API key / tanpa batas** (header `x-wp-total` menandakan pagination bebas sampai habis).

| Endpoint global | Fungsi |
|---|---|
| `https://otakudesu.com.mx/wp-json/wp/v2/categories?per_page=100` | Katalog SEMUA seri (229 kategori, 227 seri asli) |
| `https://otakudesu.com.mx/wp-json/wp/v2/posts?per_page=100&page=1..25` | Dump GLOBAL 2.440 episode (all-anime, 1 request/100 eps) |
| `https://otakudesu.com.mx/wp-json/wp/v2/users` | Enum user (admin: timothy / ID 3) |
| `https://otakudesu.com.mx/wp-admin/admin-ajax.php` + `action=ts_ac_do_search&keyword=` | Pencarian JSON seluruh katalog |

## Semua kategori → API episode per seri (nama | eps | api)

Cara pakai baris di bawah: `curl "<API>"` → JSON 100 episode pertama (judul + tanggal + link).
Ganti `page=2,3,…` di akhir URL untuk episode berikutnya; berhenti saat array kosong.
Gambar poster per seri: buka halaman seri `https://otakudesu.com.mx/<slug>/` → ambil `<meta property="og:image">`.

| nama | eps | api |
|---|---|---|
| 29-sai Dokushin Chuuken Boukensha no Nichijou | 2 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=57&per_page=100` |
| [Oshi no Ko] 3rd Season | 10 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=59&per_page=100` |
| A Good Day to Ascend | 10 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=271&per_page=100` |
| A Livid Lady's Guide to Getting Even: How I Crushed My Homeland with My Mighty Grimoires | 9 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=193&per_page=100` |
| A Will Eternal Final Season | 9 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=269&per_page=100` |
| Against the Gods 2nd Season | 11 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=203&per_page=100` |
| Agents of the Four Seasons: Dance of Spring | 14 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=104&per_page=100` |
| Akane-banashi | 12 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=148&per_page=100` |
| Ao no Miburo: Serizawa Ansatsu-hen | 1 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=147&per_page=100` |
| Arne no Jikenbo | 2 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=53&per_page=100` |
| Ascendance of a Bookworm: Adopted Daughter of an Archduke | 21 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=181&per_page=100` |
| Awajima Hyakkei | 11 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=180&per_page=100` |
| Azur Lane: Slow Ahead! Season 2 | 9 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=225&per_page=100` |
| B.King | 12 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=27&per_page=100` |
| BanG Dream! Yume∞Mita | 12 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=257&per_page=100` |
| Beyblade X | 20 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=184&per_page=100` |
| Black Torch | 10 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=245&per_page=100` |
| Bleach: Thousand-Year Blood War - The Calamity | 7 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=266&per_page=100` |
| Blue Miburo Season 2 | 1 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=23&per_page=100` |
| Bungo Stray Dogs Wan! 2 | 10 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=256&per_page=100` |
| Candy Caries | 21 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=206&per_page=100` |
| Cardfight!! Vanguard: Divinez Genma Seisen-hen | 2 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=79&per_page=100` |
| Chainsmoker Cat | 10 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=208&per_page=100` |
| Cheng He Titong 2nd Season | 1 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=90&per_page=100` |
| Class de 2-banme ni Kawaii Onnanoko to Tomodachi ni Natta | 12 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=124&per_page=100` |
| Clevatess Season 2 | 10 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=195&per_page=100` |
| Crowned in a Hundred Days | 21 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=216&per_page=100` |
| Dadao Duxing: Die Long Bian | 16 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=163&per_page=100` |
| Daemons of the Shadow Realm | 22 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=267&per_page=100` |
| Daikenja Riddle no Jikan Gyakkou | 11 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=127&per_page=100` |
| Dandelion | 2 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=179&per_page=100` |
| Dao Yao Xing | 27 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=145&per_page=100` |
| Dara-san of Reiwa | 10 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=255&per_page=100` |
| Dark Moon: Tsuki no Saidan | 2 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=78&per_page=100` |
| Darwin Jihen | 13 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=51&per_page=100` |
| Dead Account | 2 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=84&per_page=100` |
| Diamond no Ace: Act II Second Season | 11 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=156&per_page=100` |
| Digimon Beatbreak | 40 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=92&per_page=100` |
| Dorohedoro Season 2 | 11 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=129&per_page=100` |
| Douse, Koishite Shimaunda. 2nd Season | 1 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=75&per_page=100` |
| Dr. Stone: Science Future Part 3 | 19 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=116&per_page=100` |
| Draw This, Then Die! | 9 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=211&per_page=100` |
| Enen no Shouboutai: San no Shou Part 2 | 3 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=80&per_page=100` |
| Eris no Seihai | 1 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=64&per_page=100` |
| Fate/strange Fake | 2 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=88&per_page=100` |
| Flaming Dodgeball Girl Danko | 8 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=234&per_page=100` |
| From Old Country Bumpkin to Master Swordsman Season 2 | 9 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=254&per_page=100` |
| From Overshadowed to Overpowered: Second Reincarnation of a Talentless Sage | 11 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=260&per_page=100` |
| Fumetsu no Anata e Season 3 | 3 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=87&per_page=100` |
| Gals Can't Be Kind to Otaku!? | 12 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=192&per_page=100` |
| Ganbare! Nakamura-kun!! | 13 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=132&per_page=100` |
| Ganglion | 2 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=74&per_page=100` |
| GANSO! BanG Dream Chan | 22 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=143&per_page=100` |
| Ghost Concert: Missing Songs | 12 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=159&per_page=100` |
| Golden Kamuy: Saishuushou | 13 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=32&per_page=100` |
| Goodbye, Lara | 9 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=227&per_page=100` |
| Grand Blue Dreaming Season 3 | 9 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=237&per_page=100` |
| Grow Up Show: Sunflower Circus | 8 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=265&per_page=100` |
| Haibara-kun no Tsuyokute Seishun New Game | 12 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=139&per_page=100` |
| Hana-Kimi Season 2 | 2 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=273&per_page=100` |
| Hanaori-san Still Wants to Fight in the Next Life | 8 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=221&per_page=100` |
| Hell Mode: The Hardcore Gamer Dominates in Another World with Garbage Balancing Season 2 | 9 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=213&per_page=100` |
| Hell Mode: Yarikomizuki no Gamer wa Hai Settei no Isekai de Musou suru | 2 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=77&per_page=100` |
| Heroine? Saint? No, I'm an All-Works Maid (And Proud of It)! | 10 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=196&per_page=100` |
| Hidarikiki no Eren | 13 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=176&per_page=100` |
| High School! Kimengumi (2026) | 1 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=101&per_page=100` |
| Hikuidori: Ushuu Boro Tobi-gumi | 2 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=100&per_page=100` |
| Himekishi wa Barbaroi no Yome | 12 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=123&per_page=100` |
| Himesama "Goumon" no Jikan desu 2nd Season | 3 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=34&per_page=100` |
| Himitsu no AiPri: Ring-hen | 2 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=25&per_page=100` |
| Hokuto no Ken: Fist of the North Star | 12 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=166&per_page=100` |
| Hokuto no Ken: Kenougun Zako-tachi no Banka | 1 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=28&per_page=100` |
| Honzuki no Gekokujou: Shisho ni Naru Tame ni wa Shudan wo Erandeiraremasen | 23 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=119&per_page=100` |
| Hyakki Yakoushou | 12 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=174&per_page=100` |
| I Became a Legend After My 10 Year-Long Last Stand | 10 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=214&per_page=100` |
| I Want to End This Love Game | 12 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=189&per_page=100` |
| I Want to Love You Till Your Dying Day | 8 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=239&per_page=100` |
| Ichijouma Mankitsugurashi! | 11 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=175&per_page=100` |
| Iron Wok Jan! | 10 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=250&per_page=100` |
| Isekai de Cheat Skill wo Te ni Shita Ore wa, Genjitsu Sekai wo mo Musou Suru: Level Up wa Jinsei wo Kaeta | 1 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=108&per_page=100` |
| Isekai no Sata wa Shachiku Shidai | 1 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=41&per_page=100` |
| Isekai Nonbiri Nouka 2 | 12 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=121&per_page=100` |
| Jaadugar: A Witch in Mongolia | 10 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=224&per_page=100` |
| Jian Lai 2nd Season | 2 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=173&per_page=100` |
| Jidou Hanbaiki ni Umarekawatta Ore wa Meikyuu wo Samayou 3rd Season | 12 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=128&per_page=100` |
| Jigoku Sensei Nube (2025) Part 2 | 1 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=62&per_page=100` |
| Jigokuraku 2nd Season | 1 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=97&per_page=100` |
| Jingai Kyoushitsu no Ningengirai Kyoushi | 3 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=86&per_page=100` |
| Jishou Akuyaku Reijou na Konyakusha no Kansatsu Kiroku. | 11 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=170&per_page=100` |
| Jiu Yang Wushen | 2 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=146&per_page=100` |
| Journal with Witch | 1 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=98&per_page=100` |
| Jujutsu Kaisen: Shimetsu Kaiyuu - Zenpen | 1 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=68&per_page=100` |
| Kaiju Girl Caramelise | 10 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=262&per_page=100` |
| Kami no Niwatsuki Kusunoki-tei | 12 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=151&per_page=100` |
| Kami no Shizuku | 21 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=167&per_page=100` |
| Kamiina Botan, Yoeru Sugata wa Yuri no Hana | 12 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=168&per_page=100` |
| KAMUI: He's Behind You | 9 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=218&per_page=100` |
| Kanan-sama wa Akumade Choroi | 12 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=152&per_page=100` |
| Kanojo, Okarishimasu 5th Season | 22 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=165&per_page=100` |
| Kaya-chan wa Kowakunai | 1 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=95&per_page=100` |
| Kill Ao | 12 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=171&per_page=100` |
| Kirio Fanclub | 11 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=136&per_page=100` |
| Koala's Diary | 21 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=133&per_page=100` |
| Komekami! Girls | 12 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=137&per_page=100` |
| Koori no Jouheki | 12 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=134&per_page=100` |
| Kujima Utaeba Ie Hororo | 11 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=162&per_page=100` |
| Let's Go Kaikigumi | 10 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=228&per_page=100` |
| Liar Game | 21 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=125&per_page=100` |
| Link Click Season 3 | 5 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=270&per_page=100` |
| Love Unseen Beneath the Clear Night Sky | 8 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=231&per_page=100` |
| Magical Girl Lyrical Nanoha EXCEEDS Gun Blaze Vengeance | 9 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=223&per_page=100` |
| Magical Sisters Lulutto Lilly | 12 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=182&per_page=100` |
| Magilumiere Magical Girls Inc. Season 2 | 6 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=246&per_page=100` |
| Mahou no Shimai Lulutto Lilly | 12 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=160&per_page=100` |
| Maid-san wa Taberu dake | 12 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=126&per_page=100` |
| Mairimashita! Iruma-kun 4th Season | 23 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=120&per_page=100` |
| Mamonogurai no Boukensha: Ore dake Mamono wo Kuratte Tsuyoku Naru | 12 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=135&per_page=100` |
| Mao | 23 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=149&per_page=100` |
| Maou no Musume wa Yasashisugiru!! | 1 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=36&per_page=100` |
| Marriagetoxin | 13 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=178&per_page=100` |
| Mata Korosarete Shimatta no desu ne, Tantei-sama | 12 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=140&per_page=100` |
| Mato Seihei no Slave 2 | 1 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=67&per_page=100` |
| Mayonaka Heart Tune | 1 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=38&per_page=100` |
| Mebius Dust | 9 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=258&per_page=100` |
| Megami "Isekai Tensei Nani ni Naritai desu ka" Ore "Yuusha no Rokkotsu de" | 20 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=161&per_page=100` |
| Meitantei Conan | 17 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=82&per_page=100` |
| Meitantei Precure! | 25 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=105&per_page=100` |
| Mission: Yozakura Family Season 2 | 11 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=185&per_page=100` |
| Mushen Ji | 1 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=109&per_page=100` |
| Mushoku Tensei: Jobless Reincarnation Season 3 | 6 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=247&per_page=100` |
| My Hero Academia: More | 1 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=248&per_page=100` |
| My Stepmother and Stepsisters Aren't Wicked | 8 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=244&per_page=100` |
| Needy Girl Overdose | 13 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=150&per_page=100` |
| Nigashita Sakana wa Ookikatta ga Tsuriageta Sakana ga Ookisugita Ken | 12 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=131&per_page=100` |
| Nippon Sangoku | 12 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=158&per_page=100` |
| Niwatori Fighter | 12 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=107&per_page=100` |
| Odayaka Kizoku no Kyuuka no Susume. | 1 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=58&per_page=100` |
| Oh Boy, Was I Wrong About Her | 8 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=236&per_page=100` |
| Okiraku Ryoushu no Tanoshii Ryouchi Bouei: Seisankei Majutsu de Na mo Naki Mura wo Saikyou no Jousai Toshi ni | 2 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=55&per_page=100` |
| On The Edge 3rd Season | 14 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=201&per_page=100` |
| One Hundred Thousand Years of Qi Refining | 8 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=204&per_page=100` |
| One Piece | 92 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=153&per_page=100` |
| Onegai AiPri | 2 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=154&per_page=100` |
| Onmyo Kaiten Re:Birth Verse | 12 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=200&per_page=100` |
| Otonari no Tenshi-sama ni Itsunomanika Dame Ningen ni Sareteita Ken 2 | 12 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=115&per_page=100` |
| Pardon the Intrusion, I'm Home! | 10 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=190&per_page=100` |
| Perfect Addiction | 8 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=243&per_page=100` |
| Please Excuse My Younger Brothers | 10 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=210&per_page=100` |
| Pokemon (2023) | 7 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=83&per_page=100` |
| Princession Orchestra | 1 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=35&per_page=100` |
| Re:Zero kara Hajimeru Isekai Seikatsu 4th Season | 11 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=111&per_page=100` |
| Reborn as a Vending Machine, I Now Wander the Dungeon Season 2 | 12 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=202&per_page=100` |
| Recommendations from Iwamoto-Senpai | 10 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=263&per_page=100` |
| Red River | 9 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=194&per_page=100` |
| Reincarnation no Kaben | 13 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=138&per_page=100` |
| Renegade Immortal | 5 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=229&per_page=100` |
| Replica datte, Koi wo Suru. | 13 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=177&per_page=100` |
| Rich Girl Caretaker: I'm Secretly the Caregiver of the Most Popular Girl in This Rich Kid School | 9 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=220&per_page=100` |
| Rilakkuma | 21 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=172&per_page=100` |
| Roll Over and Die | 11 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=70&per_page=100` |
| Saga of Tanya the Evil II | 9 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=199&per_page=100` |
| Saikyou no Ousama, Nidome no Jinsei wa Nani wo Suru? Season 2 | 12 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=122&per_page=100` |
| Saikyou no Shokugyou wa Yuusha demo Kenja demo Naku Kanteishi (Kari) Rashii desu yo? | 12 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=130&per_page=100` |
| Saioshi no Gikei wo Mederu Tame, Nagaiki shimasu! | 3 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=52&per_page=100` |
| Saved by the Ice Cold Prince's Embrace | 13 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=240&per_page=100` |
| Seihantai na Kimi to Boku | 1 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=94&per_page=100` |
| Shin Chan | 51 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=272&per_page=100` |
| SI-VIS: The Sound of Heroes | 1 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=91&per_page=100` |
| Skeleton Knight in Another World II | 7 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=232&per_page=100` |
| Smoking Behind the Supermarket with You | 9 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=259&per_page=100` |
| Snowball Earth | 13 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=141&per_page=100` |
| Sousou no Frieren 2nd Season | 2 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=76&per_page=100` |
| Sparks of Tomorrow | 10 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=249&per_page=100` |
| Spy x Sect | 9 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=209&per_page=100` |
| Tamon-kun Ima Docchi!? | 2 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=60&per_page=100` |
| Tensei Akujo no Kuro Rekishi | 12 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=155&per_page=100` |
| Tensei shitara Dragon no Tamago datta | 1 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=81&per_page=100` |
| Tensei shitara Slime Datta Ken 4th Season | 21 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=112&per_page=100` |
| The Cat and the Dragon | 5 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=264&per_page=100` |
| The Classroom of a Black Cat and a Witch | 21 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=183&per_page=100` |
| The Drops of God | 21 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=212&per_page=100` |
| The Duke's Son Claims He Won't Love Me Yet Showers Me with Adoration | 10 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=268&per_page=100` |
| The Elusive Samurai Season 2 | 9 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=219&per_page=100` |
| The Exiled Heavy Knight Knows How to Game the System | 10 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=261&per_page=100` |
| The Forsaken Saintess and her Foodie Roadtrip in Another World | 8 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=235&per_page=100` |
| The Frontier Lord Begins with Zero Subjects | 9 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=215&per_page=100` |
| The Ghost in the Shell | 9 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=253&per_page=100` |
| The Insipid Prince's Furtive Grab for The Throne | 9 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=230&per_page=100` |
| The Klutzy Class Monitor and the Girl with the Short Skirt | 12 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=187&per_page=100` |
| The Most Heretical Last Boss Queen: From Villainess to Savior Season 2 | 12 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=188&per_page=100` |
| The Ogre's Bride | 9 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=222&per_page=100` |
| The Villager of Level 999 | 10 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=197&per_page=100` |
| The Villainess Is Adored by the Prince of the Neighbor Kingdom | 1 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=96&per_page=100` |
| The World Is Dancing | 8 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=233&per_page=100` |
| The World's Strongest Rearguard | 7 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=252&per_page=100` |
| Though I Am an Inept Villainess | 8 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=226&per_page=100` |
| Thunder 3 | 9 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=205&per_page=100` |
| Tomb Raider King | 11 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=198&per_page=100` |
| Tongari Boushi no Atelier | 13 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=114&per_page=100` |
| Toumei Otoko to Ningen Onna: Sonouchi Fuufu ni Naru Futari | 1 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=65&per_page=100` |
| Trigun Stargaze | 2 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=85&per_page=100` |
| Tsue to Tsurugi no Wistoria Season 2 | 12 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=117&per_page=100` |
| Ugoku! Neko Mukashibanashi | 24 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=54&per_page=100` |
| Uruwashi no Yoi no Tsuki | 1 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=93&per_page=100` |
| Versatile Mage Season 7 | 14 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=191&per_page=100` |
| Victoria of Many Faces | 8 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=242&per_page=100` |
| Vigilante: Boku no Hero Academia Illegals 2nd Season | 1 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=31&per_page=100` |
| Wash It All Away | 1 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=30&per_page=100` |
| Wei Miao Rensheng | 36 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=142&per_page=100` |
| Wistoria: Wand and Sword Season 2 | 12 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=186&per_page=100` |
| Word of Honor 2 | 8 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=207&per_page=100` |
| Xuan Jie Zhi Men | 7 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=164&per_page=100` |
| Yami Shibai 16 | 2 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=103&per_page=100` |
| Yi Ren Zhi Xia 6 | 15 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=71&per_page=100` |
| Yomi no Tsugai | 22 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=118&per_page=100` |
| Yong Sheng: Tai Yuan Xian Fu | 11 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=144&per_page=100` |
| Yoroi Shin Den Samurai Troopers | 1 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=50&per_page=100` |
| Yoroi-Shinden Samurai Troopers Part 2 | 9 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=241&per_page=100` |
| You and I Are Polar Opposites Season 2 | 10 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=251&per_page=100` |
| You Shou Yan 5th Season | 6 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=72&per_page=100` |
| Youkoso Jitsuryoku Shijou Shugi no Kyoushitsu e 4th Season: 2-nensei-hen 1 Gakki | 18 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=113&per_page=100` |
| Young Ladies Don't Play Fighting Games | 8 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=238&per_page=100` |
| Yowayowa Sensei | 12 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=169&per_page=100` |
| Yuusha no Kuzu | 14 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=89&per_page=100` |
| Yuusha Party ni Kawaii Ko ga Ita node, Kokuhaku shitemita. | 11 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=39&per_page=100` |
| Yuusha-kei ni Shosu: Choubatsu Yuusha 9004-tai Keimu Kiroku | 1 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=63&per_page=100` |
| Ze Tian Ji (2026) | 17 | `https://otakudesu.com.mx/wp-json/wp/v2/posts?categories=106&per_page=100` |
