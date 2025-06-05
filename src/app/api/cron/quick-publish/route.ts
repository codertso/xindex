
// src/app/api/cron/quick-publish/route.ts
import { NextResponse } from 'next/server';
import { triggerScheduledQuickPublish } from '@/app/actions'; 

// Helper function to get the start of "today" in Beijing time,
// and return it as a Date object whose UTC date parts match Beijing's date parts.
function getStartOfTodayBeijingForCron(): Date {
  const nowUtc = new Date(); // Current UTC time on the server

  // Get year, month, day parts according to Beijing timezone
  const year = nowUtc.toLocaleString('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric' });
  const month = nowUtc.toLocaleString('en-CA', { timeZone: 'Asia/Shanghai', month: '2-digit' });
  const day = nowUtc.toLocaleString('en-CA', { timeZone: 'Asia/Shanghai', day: '2-digit' });

  // Create a new Date object from these parts.
  // When new Date("YYYY-MM-DD") is called, it's parsed as YYYY-MM-DD T00:00:00.000Z (UTC midnight).
  // This is what `fetchRMRBFrontPage` expects if it's to extract UTC date parts
  // that correspond to the Beijing date.
  return new Date(`${year}-${month}-${day}`);
}


export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("CRON_SECRET environment variable is not set on the server.");
    // Do not expose the absence of CRON_SECRET directly in the response for security reasons.
    return NextResponse.json({ success: false, message: "Server configuration error." }, { status: 500 });
  }
  
  // Check if a secret was provided in the request.
  // For Vercel Cron, this is typically done via a query parameter in the cron job URL,
  // or by checking a 'Authorization: Bearer <secret>' header.
  // For simplicity, if CRON_SECRET is set on the server, we'll expect the client to match it.
  // Vercel documentation suggests using 'Authorization: Bearer <secret>'.
  
  if (authHeader !== `Bearer ${cronSecret}`) {
    console.warn("Unauthorized attempt to access cron job quick-publish.");
    // Do not give specific reasons for auth failure in the response.
    return NextResponse.json({ success: false, message: "Unauthorized access." }, { status: 401 });
  }


  try {
    const targetFetchDate = getStartOfTodayBeijingForCron();
    console.log(`Cron job 'quick-publish' triggered. Determined target fetch date (Beijing): ${targetFetchDate.toISOString().split('T')[0]}`);
    
    const result = await triggerScheduledQuickPublish(targetFetchDate);
    
    if (result.success) {
      console.log(`Cron job 'quick-publish' completed successfully: ${result.message}`);
      return NextResponse.json({ success: true, data: result });
    } else {
      console.error(`Cron job 'quick-publish' failed: ${result.message}`);
      return NextResponse.json({ success: false, message: result.message, data: result }, { status: 500 });
    }
  } catch (error: any) {
    console.error("Error in cron job 'quick-publish' handler:", error);
    return NextResponse.json({ success: false, message: error.message || "An unknown error occurred." }, { status: 500 });
  }
}

    
