import io
import urllib.request
from openpyxl import load_workbook

url="https://www.investor.asml.com/static-files/78b1af6f-9c6e-4e5c-b229-a418251687ff"
req=urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0","Accept":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"})
with urllib.request.urlopen(req,timeout=35) as r:
  raw=r.read()
print("Downloaded bytes",len(raw),"signature",raw[:8])
wb=load_workbook(io.BytesIO(raw),read_only=True,data_only=True)
print("Sheets",wb.sheetnames)
for ws in wb.worksheets[:4]:
  print("SHEET",ws.title,ws.max_row,ws.max_column)
  for row in ws.iter_rows(min_row=1,max_row=min(ws.max_row,100),values_only=True):
    texts=[str(x)[:65] if x is not None else "" for x in row[:9]]
    if any(texts):
      print("|".join(texts))
