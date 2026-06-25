import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import db from '../models/database';
import { encrypt, decrypt } from '@services/security';
import { requireRole } from '../middleware/auth';
import { executeDbskiter } from '@services/database';

const router = Router();

/** 数据库连接记录 */
interface DbConnection {
    id: string;
    name: string;
    db_type: string;
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
    description?: string;
    tags?: string;
    enabled: number;
    created_at?: string;
    updated_at?: string;
}

/** 获取所有数据库连接 */
router.get('/', (_req: Request, res: Response) => {
    try {
        const rows = db.prepare('SELECT * FROM databases ORDER BY created_at DESC').all() as DbConnection[];
        const list = rows.map((r) => ({
            ...r,
            password: '', // 返回时抹掉密码，安全考虑
        }));
        res.json({ success: true, data: list });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to get database connections' });
    }
});

/** 获取单个数据库连接 */
router.get('/:id', requireRole('admin', 'operator'), (_req: Request, res: Response) => {
    try {
        const row = db.prepare('SELECT * FROM databases WHERE id = ?').get(_req.params.id) as DbConnection | undefined;
        if (!row) {
            return res.status(404).json({ success: false, error: 'Database connection not found' });
        }
        res.json({ success: true, data: { ...row, password: '' } });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to get database connection' });
    }
});

/** 创建数据库连接 */
router.post('/', requireRole('admin', 'operator'), (req: Request, res: Response) => {
    try {
        const { name, db_type, host, port, username, password, database, description, tags } = req.body;
        if (!name || !host || !username || !password || !database) {
            return res.status(400).json({ success: false, error: 'Missing required fields: name, host, username, password, database' });
        }

        const id = randomUUID();
        const encryptedPassword = encrypt(password);
        db.prepare(`
            INSERT INTO databases (id, name, db_type, host, port, username, password, database, description, tags, enabled, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'), datetime('now','localtime'))
        `).run(id, name, db_type || 'mysql', host, port || 3306, username, encryptedPassword, database, description || null, tags ? JSON.stringify(tags) : null, 1);

        res.json({ success: true, data: { id } });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to create database connection' });
    }
});

/** 更新数据库连接 */
router.put('/:id', requireRole('admin', 'operator'), (req: Request, res: Response) => {
    try {
        const { name, db_type, host, port, username, password, database, description, tags, enabled } = req.body;
        const existing = db.prepare('SELECT * FROM databases WHERE id = ?').get(req.params.id) as DbConnection | undefined;
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Database connection not found' });
        }

        const encryptedPassword = password ? encrypt(password) : existing.password;
        db.prepare(`
            UPDATE databases
            SET name = ?, db_type = ?, host = ?, port = ?, username = ?, password = ?, database = ?, description = ?, tags = ?, enabled = ?, updated_at = datetime('now','localtime')
            WHERE id = ?
        `).run(
            name || existing.name,
            db_type || existing.db_type,
            host || existing.host,
            port || existing.port,
            username || existing.username,
            encryptedPassword,
            database || existing.database,
            description !== undefined ? description : existing.description,
            tags ? JSON.stringify(tags) : existing.tags,
            enabled !== undefined ? (enabled ? 1 : 0) : existing.enabled,
            req.params.id
        );

        res.json({ success: true, message: 'Database connection updated' });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to update database connection' });
    }
});

/** 删除数据库连接 */
router.delete('/:id', requireRole('admin'), (req: Request, res: Response) => {
    try {
        db.prepare('DELETE FROM databases WHERE id = ?').run(req.params.id);
        res.json({ success: true, message: 'Database connection deleted' });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to delete database connection' });
    }
});

/** 测试数据库连接 */
router.post('/:id/test', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
    try {
        const row = db.prepare('SELECT * FROM databases WHERE id = ?').get(req.params.id) as DbConnection | undefined;
        if (!row) {
            return res.status(404).json({ success: false, error: 'Database connection not found' });
        }

        let decryptedPassword: string;
        try {
            decryptedPassword = decrypt(row.password);
        } catch (_e) {
            decryptedPassword = row.password;
        }

        const result = await executeDbskiter({
            connection: {
                dialect: row.db_type,
                host: row.host,
                port: row.port,
                user: row.username,
                password: decryptedPassword,
                database: row.database,
            },
            operation: 'monitor',
            subCommand: 'health',
            timeout: 15000,
        });

        if (result.success) {
            res.json({ success: true, message: '数据库连接成功', data: { name: row.name, host: row.host, port: row.port, database: row.database, duration: result.duration } });
        } else {
            res.status(400).json({ success: false, error: '数据库连接失败', detail: result.error || result.stderr });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to test connection' });
    }
});

/** 直接测试连接（不保存，用于创建前验证） */
router.post('/test-connect', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
    try {
        const { db_type, host, port, username, password, database } = req.body;
        if (!host || !username || !password || !database) {
            return res.status(400).json({ success: false, error: 'Missing required fields: host, username, password, database' });
        }

        const result = await executeDbskiter({
            connection: {
                dialect: db_type || 'mysql',
                host,
                port: port || 3306,
                user: username,
                password,
                database,
            },
            operation: 'monitor',
            subCommand: 'health',
            timeout: 15000,
        });

        if (result.success) {
            res.json({ success: true, message: '数据库连接成功', duration: result.duration });
        } else {
            res.status(400).json({ success: false, error: '数据库连接失败', detail: result.error || result.stderr });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to test connection' });
    }
});

export default router;
