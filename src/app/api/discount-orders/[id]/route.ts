
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function DELETE(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    const id = params.id;

    if (!id) {
        return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
        console.log(`🗑️ [API] Deleting discount order: ${id}`);

        // 1. Delete the PDF file from storage
        const bucket = 'ordens-desconto-pdfs';
        const fileName = `discount-order-${id}.pdf`;

        // Check if file exists first? Or just try to remove.
        const { error: storageError } = await supabase.storage
            .from(bucket)
            .remove([fileName]);

        if (storageError) {
            console.warn(`⚠️ [API] Warning: Failed to delete file ${fileName} from storage:`, storageError);
            // We continue to delete the record
        } else {
            console.log(`✅ [API] File ${fileName} deleted from storage`);
        }

        // 2. Delete the record from the database
        const { error: dbError } = await supabase
            .from('discount_orders')
            .delete()
            .eq('id', id);

        if (dbError) {
            console.error('❌ [API] Error deleting order from DB:', dbError);
            return NextResponse.json({ error: dbError.message }, { status: 500 });
        }

        console.log(`✅ [API] Order ${id} deleted from DB`);
        return NextResponse.json({ message: 'Order deleted successfully' }, { status: 200 });
    } catch (error) {
        console.error('❌ [API] Unexpected error during deletion:', error);
        return NextResponse.json({ error: 'Internal Server Error', details: error }, { status: 500 });
    }
}
