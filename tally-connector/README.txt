================================================================
          ANISH TECHNOLOGIES - TALLY CONNECTOR SETUP GUIDE
================================================================

[HINDI / ENGLISH INSTRUCTIONS]

1. TALLYPRIME ME CONFIGURATION KAREIN:
   - TallyPrime open karein aur apni Company load karein.
   - Top menu me "F1: Help" -> "Settings" -> "Connectivity" par jayein.
   - "Client/Server configuration" par Enter dabayein:
     * TallyPrime acting as: Both (ya Server)
     * Enable ODBC: Yes
     * Port: 9000
   - TallyPrime ko restart karein aur company open rakhein.

2. CONNECTOR RUN KAREIN:
   - "START-ANISH-TALLY-CONNECTOR.cmd" par double-click karein.
   - Yeh automatically portable Node.js runtime check/download karega.
   - Black window open hogi jisme likha aayega:
     Office Code: ANISH-XXXXXXXX
     Secure Relay: Connected!
   - Is black window ko band na karein (minimize kar sakte hain).

3. WEBSITE ME CONNECT KAREIN:
   - https://anish-tech.online/invoice (ya apni invoice website) open karein.
   - Top right me "Tally Connect" button par click karein.
   - Apna "Office Code" (jo black window me dikh raha hai) enter karein.
   - "Test & Connect" click karein.
   - "Sync Debtors", "Sync Items", "Sync Invoices" par click karein.
   - Saara data Tally se direct website me import ho jayega!

SUPPORT:
Relay: https://tally-relay-anil-sharma.onrender.com
Default Tally Port: 9000
================================================================
