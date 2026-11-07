/* =============================================================================
 * POLITICAS DE SEGURIDAD A NIVEL DE FILAS (ROW-LEVEL SECURITY - RLS) Y SAFE-MODE
 * Base de Datos: Azure SQL Database (SIO)
 * Propósito:
 *   1. Garantizar aislamiento departamental (GHA = 16) mediante SESSION_CONTEXT.
 *   2. Prevenir vulnerabilidades IDOR (lectura o escritura fuera del departamento/usuario).
 *   3. Impedir eliminaciones físicas destructivas (DELETE), obligando al uso de
 *      borrado lógico (EstaEliminado = 1).
 * ============================================================================= */

-- 1. Crear esquema dedicado para objetos de seguridad
IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = N'Security')
BEGIN
    EXEC('CREATE SCHEMA [Security]');
END
GO

-- 2. Función de Predicado de Seguridad RLS por Departamento y Borrado Lógico
CREATE OR ALTER FUNCTION Security.fn_securitypredicate_departamento(@DepartamentoId INT)
RETURNS TABLE
WITH SCHEMABINDING
AS
    RETURN SELECT 1 AS fn_securitypredicate_result
    WHERE
        -- Permitir si el contexto de sesión coincide con el Departamento de la fila (16 = GHA)
        CAST(SESSION_CONTEXT(N'DepartamentoId') AS INT) = @DepartamentoId
        -- O si es una cuenta administradora de base de datos en mantenimiento
        OR IS_MEMBER('db_owner') = 1;
GO

-- 3. Ejemplo de aplicación de la Política RLS sobre la tabla de Órdenes de Servicio
-- (Descomentar y ejecutar con rol db_owner en Azure SQL SIO si se requiere activar en motor)
/*
CREATE SECURITY POLICY Security.OrdenServicioDepartamentoPolicy
    ADD FILTER PREDICATE Security.fn_securitypredicate_departamento(DepartamentoId)
        ON dbo.EncabezadoOS,
    ADD BLOCK PREDICATE Security.fn_securitypredicate_departamento(DepartamentoId)
        ON dbo.EncabezadoOS AFTER INSERT,
    ADD BLOCK PREDICATE Security.fn_securitypredicate_departamento(DepartamentoId)
        ON dbo.EncabezadoOS BEFORE UPDATE
WITH (STATE = ON, SCHEMABINDING = ON);
GO
*/

-- 4. Trigger de Gobernanza Corporativa: SAFE-MODE ANTI-DELETE FÍSICO
-- Bloquea cualquier intento de DELETE físico en tablas operativas y exige EstaEliminado = 1
CREATE OR ALTER TRIGGER dbo.trg_SafeMode_PreventPhysicalDelete_Login
ON dbo.Login
INSTEAD OF DELETE
AS
BEGIN
    SET NOCOUNT ON;
    RAISERROR (
        'DIRECTIVA DE SEGURIDAD SIO: Las eliminaciones físicas (DELETE) están prohibidas. Utilice borrado lógico (UPDATE ... SET EstaEliminado = 1).',
        16,
        1
    );
    ROLLBACK TRANSACTION;
END;
GO
