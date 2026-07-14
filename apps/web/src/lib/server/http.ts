import { NextResponse } from "next/server";

/** Match NestJS exception filter style: `{ message: string | string[] }`. */
export function jsonError(message: string | string[], status: number) {
  return NextResponse.json({ message }, { status });
}

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}
