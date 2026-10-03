import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "请选择文件" }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Save to public/patterns/
    const dir = path.join(process.cwd(), "public", "patterns");
    await mkdir(dir, { recursive: true });
    const filename = file.name;
    const filepath = path.join(dir, filename);
    await writeFile(filepath, buffer);

    return NextResponse.json({ data: { url: `/patterns/${filename}`, filename } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
