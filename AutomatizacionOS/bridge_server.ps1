# =============================================================================
# PUENTE LOCAL HTTP / SQL SERVER (SIO - GHA)
# Puerto: 3080
# URL: http://127.0.0.1:3080/api/sql
# Requisitos: PowerShell 5.1+ o PowerShell Core (No requiere Node ni paquetes npm)
# =============================================================================

param (
    [int]$Port = 3080
)

$server = "mysqullaats23.database.windows.net"
$databaseSIO = "SIO"
$databaseMaster = "master"
$dbUser = "LaatsBdAD"
$dbPass = "AndresRivera!9710"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   PUENTE LOCAL SIO - AUTOMATIZACION OS GHA (Puerto: $Port)   " -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Servidor Azure SQL: $server" -ForegroundColor Gray
Write-Host "Base de Datos: $databaseSIO" -ForegroundColor Gray
Write-Host "Escuchando en: http://127.0.0.1:$Port/api/sql" -ForegroundColor Green
Write-Host "Presione CTRL+C para detener el servidor." -ForegroundColor Gray
Write-Host ""

Add-Type -AssemblyName System.Data
Add-Type -AssemblyName System.Web

function Get-SqlConnectionString([string]$database) {
    return "Server=tcp:$server,1433;Initial Catalog=$database;Persist Security Info=False;User ID=$dbUser;Password=$dbPass;MultipleActiveResultSets=False;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;"
}

function Send-JsonResponse($response, $data, [int]$statusCode = 200) {
    $json = $data | ConvertTo-Json -Depth 10 -Compress
    $buffer = [System.Text.Encoding]::UTF8.GetBytes($json)
    $response.StatusCode = $statusCode
    $response.ContentType = "application/json; charset=utf-8"
    $response.Headers.Add("Access-Control-Allow-Origin", "*")
    $response.Headers.Add("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
    $response.Headers.Add("Access-Control-Allow-Headers", "Content-Type")
    $response.ContentLength64 = $buffer.Length
    $response.OutputStream.Write($buffer, 0, $buffer.Length)
    $response.OutputStream.Close()
}

$listener = New-Object System.Net.HttpListener
$prefix = "http://127.0.0.1:$Port/"
$listener.Prefixes.Add($prefix)

try {
    $listener.Start()
} catch {
    Write-Host "Error iniciando HttpListener: $_" -ForegroundColor Red
    exit 1
}

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        # Manejo de Preflight OPTIONS para CORS
        if ($request.HttpMethod -eq "OPTIONS") {
            $response.StatusCode = 204
            $response.Headers.Add("Access-Control-Allow-Origin", "*")
            $response.Headers.Add("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
            $response.Headers.Add("Access-Control-Allow-Headers", "Content-Type")
            $response.Close()
            continue
        }

        # Servir index.html si se solicita la raíz
        if ($request.Url.AbsolutePath -eq "/" -or $request.Url.AbsolutePath -eq "/index.html") {
            $indexPath = Join-Path $PSScriptRoot "index.html"
            if (Test-Path $indexPath) {
                $htmlBytes = [System.IO.File]::ReadAllBytes($indexPath)
                $response.StatusCode = 200
                $response.ContentType = "text/html; charset=utf-8"
                $response.Headers.Add("Access-Control-Allow-Origin", "*")
                $response.ContentLength64 = $htmlBytes.Length
                $response.OutputStream.Write($htmlBytes, 0, $htmlBytes.Length)
                $response.OutputStream.Close()
                continue
            }
        }

        # Manejo de Shutdown directo vía URL /api/shutdown (cierre de ventana)
        if ($request.Url.AbsolutePath -eq "/api/shutdown") {
            Write-Host ""
            Write-Host "==========================================================" -ForegroundColor Red
            Write-Host " [$(Get-Date -Format 'HH:mm:ss')] Cierre de ventana/página detectado." -ForegroundColor Yellow
            Write-Host " Apagando servidor puente PowerShell..." -ForegroundColor Red
            Write-Host "==========================================================" -ForegroundColor Red
            Send-JsonResponse $response @{ resultado = 1; mensaje = "Servidor puente detenido correctamente." }
            Start-Sleep -Milliseconds 400
            try { $listener.Stop(); $listener.Close() } catch {}
            [System.Environment]::Exit(0)
            Stop-Process -Id $PID -Force
            return
        }

        if ($request.Url.AbsolutePath -ne "/api/sql") {
            Send-JsonResponse $response @{ resultado = -1; mensaje = "Ruta no encontrada" } 404
            continue
        }

        $reader = New-Object System.IO.StreamReader($request.InputStream, $request.ContentEncoding)
        $body = $reader.ReadToEnd()
        $reader.Close()

        $payload = $null
        if (![string]::IsNullOrWhiteSpace($body)) {
            $payload = $body | ConvertFrom-Json
        }

        $action = if ($payload.action) { $payload.action } else { "consulta" }

        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Solicitud recibida: $action" -ForegroundColor Yellow

        # -------------------------------------------------------------
        # ACCION: APAGAR SERVIDOR (CIERRE DE VENTANA DESDE NAVEGADOR)
        # -------------------------------------------------------------
        if ($action -eq "shutdown") {
            Write-Host ""
            Write-Host "==========================================================" -ForegroundColor Red
            Write-Host " [$(Get-Date -Format 'HH:mm:ss')] Cierre de ventana/página detectado." -ForegroundColor Yellow
            Write-Host " Apagando servidor puente PowerShell..." -ForegroundColor Red
            Write-Host "==========================================================" -ForegroundColor Red
            Send-JsonResponse $response @{ resultado = 1; mensaje = "Servidor puente detenido correctamente." }
            Start-Sleep -Milliseconds 400
            try { $listener.Stop(); $listener.Close() } catch {}
            [System.Environment]::Exit(0)
            Stop-Process -Id $PID -Force
            return
        }

        # -------------------------------------------------------------
        # ACCION: GUARDAR ARCHIVO HTML DE LA OS EN CARPETA INFORMACION
        # -------------------------------------------------------------
        if ($action -eq "guardar_html_os") {
            try {
                $correlativo = [string]$payload.correlativo
                $contenidoHtml = [string]$payload.contenidoHtml
                if (![string]::IsNullOrWhiteSpace($correlativo) -and ![string]::IsNullOrWhiteSpace($contenidoHtml)) {
                    $nombreArchivo = "GHA-$correlativo-AVIANCA-NA.html"
                    $rutaInformacion = Join-Path (Split-Path $PSScriptRoot -Parent) "Informacion"
                    if (!(Test-Path $rutaInformacion)) {
                        New-Item -ItemType Directory -Path $rutaInformacion -Force | Out-Null
                    }
                    $rutaDestino = Join-Path $rutaInformacion $nombreArchivo
                    [System.IO.File]::WriteAllText($rutaDestino, $contenidoHtml, [System.Text.Encoding]::UTF8)
                    Write-Host "  -> Archivo HTML de la OS guardado exitosamente en: $rutaDestino" -ForegroundColor Green
                    Send-JsonResponse $response @{
                        resultado = 1
                        mensaje = "Archivo guardado exitosamente en la carpeta Información"
                        ruta = $rutaDestino
                        nombreArchivo = $nombreArchivo
                    }
                } else {
                    Send-JsonResponse $response @{ resultado = -1; mensaje = "Datos insuficientes para guardar el archivo HTML" }
                }
            } catch {
                Send-JsonResponse $response @{ resultado = -1; mensaje = "Error guardando HTML: $($_.Exception.Message)" }
            }
            continue
        }

        # -------------------------------------------------------------
        # ACCION 1: LOGIN POR PIN (VALIDADO POR DEPARTAMENTO GHA = 16)
        # -------------------------------------------------------------
        if ($action -eq "login") {
            $pin = [string]$payload.pin
            if ([string]::IsNullOrWhiteSpace($pin)) {
                Send-JsonResponse $response @{ resultado = 0; mensaje = "Debe proporcionar un PIN de acceso." }
                continue
            }

            $connString = Get-SqlConnectionString $databaseSIO
            $conn = New-Object System.Data.SqlClient.SqlConnection($connString)
            $conn.Open()

            $query = @"
SELECT TOP (1) 
    l.LoginId, 
    l.Usuario, 
    e.EmpleadoId, 
    e.Nombre,
    ISNULL(p.Nombre, 'COLABORADOR') AS Puesto,
    ISNULL(di.DepartamentoInternoId, 0) AS DepartamentoInternoId,
    ISNULL(di.DepartamentoInterno, 'SIN ASIGNAR') AS DepartamentoInterno
FROM dbo.Login AS l
INNER JOIN dbo.Empleado AS e ON e.EmpleadoId = l.EmpleadoId
LEFT JOIN dbo.Puesto AS p ON p.PuestoId = e.PuestoId
LEFT JOIN dbo.DepartamentoDepInterno AS ddi ON ddi.DepartamentoId = e.DepartamentoId
LEFT JOIN dbo.DepartamentoInterno AS di ON di.DepartamentoInternoId = ddi.DepartamentoInternoId
WHERE l.Password = @Pin AND l.EstaEliminado = 0;
"@
            $cmd = New-Object System.Data.SqlClient.SqlCommand($query, $conn)
            [void]$cmd.Parameters.AddWithValue("@Pin", $pin.Trim())

            $dr = $cmd.ExecuteReader()
            if ($dr.Read()) {
                $deptoId = [int]$dr["DepartamentoInternoId"]
                $deptoNombre = [string]$dr["DepartamentoInterno"]
                $nombreColab = [string]$dr["Nombre"]

                # Validación de pertenencia al departamento GHA (DepartamentoInternoId = 16)
                if ($deptoId -ne 16 -and $deptoNombre -ne "GHA") {
                    $dr.Close()
                    $conn.Close()
                    Write-Host "  -> Acceso denegado: $nombreColab pertenece a '$deptoNombre' (ID: $deptoId) y no a GHA." -ForegroundColor Yellow
                    Send-JsonResponse $response @{
                        resultado = 0
                        mensaje = "Acceso denegado: El colaborador '$nombreColab' pertenece al departamento '$deptoNombre'. Este módulo es exclusivo para personal del departamento GHA."
                    }
                    continue
                }

                $userData = @{
                    LoginId = $dr["LoginId"]
                    Usuario = $dr["Usuario"]
                    EmpleadoId = $dr["EmpleadoId"]
                    Nombre = $nombreColab
                    Puesto = $dr["Puesto"]
                    Departamento = $deptoNombre
                    DepartamentoInternoId = $deptoId
                }
                $dr.Close()
                $conn.Close()

                Write-Host "  -> Login GHA exitoso: $($userData.Nombre) (ID: $($userData.LoginId))" -ForegroundColor Green
                Send-JsonResponse $response @{
                    resultado = 1
                    mensaje = "Autenticación exitosa (Departamento GHA)"
                    usuario = $userData
                }
            } else {
                $dr.Close()
                $conn.Close()
                Write-Host "  -> PIN no encontrado o inactivo" -ForegroundColor Red
                Send-JsonResponse $response @{
                    resultado = 0
                    mensaje = "PIN no encontrado o usuario inactivo en la base de datos SIO."
                }
            }
            continue
        }

        # -------------------------------------------------------------
        # ACCION 2: TEST DE CONEXION
        # -------------------------------------------------------------
        if ($action -eq "test_connection") {
            try {
                $connString = Get-SqlConnectionString $databaseSIO
                $conn = New-Object System.Data.SqlClient.SqlConnection($connString)
                $conn.Open()
                $cmd = New-Object System.Data.SqlClient.SqlCommand("SELECT @@VERSION AS Version, DB_NAME() AS BaseDatos;", $conn)
                $dr = $cmd.ExecuteReader()
                $dbName = ""
                if ($dr.Read()) { $dbName = $dr["BaseDatos"] }
                $dr.Close()
                $conn.Close()

                Send-JsonResponse $response @{
                    resultado = 1
                    mensaje = "Conexión exitosa a Azure SQL ($dbName)"
                    servidor = $server
                }
            } catch {
                Send-JsonResponse $response @{
                    resultado = -1
                    mensaje = "Error de conexión: $($_.Exception.Message)"
                }
            }
            continue
        }

        # -------------------------------------------------------------
        # ACCION 3: INSERCION MASIVA DE ORDEN DE SERVICIO (GHA)
        # PROCEDIMIENTO UNIFICADO: dbo.InsertarOrdenServicioMasivaGHA
        # -------------------------------------------------------------
        if ($action -eq "insert_os_masiva") {
            $loginId = [int]$payload.loginId
            $nombreModificado = [string]$payload.nombreModificado
            $fechaOS = [string]$payload.fechaOS
            $operadorId = if ($payload.operadorId) { [int]$payload.operadorId } else { 19 }
            $filas = $payload.filas

            if ($loginId -le 0 -or !$filas -or $filas.Count -eq 0) {
                Send-JsonResponse $response @{ resultado = -1; mensaje = "Datos insuficientes para la inserción masiva." }
                continue
            }

            Write-Host "  -> Iniciando inserción masiva: $($filas.Count) registros por LoginId $loginId..." -ForegroundColor Cyan

            $detallesJson = $filas | ConvertTo-Json -Depth 5 -Compress
            $connString = Get-SqlConnectionString $databaseSIO
            $conn = New-Object System.Data.SqlClient.SqlConnection($connString)
            $conn.Open()

            $ejecutadoConExito = $false
            $errorProcedimientoUnificado = $null

            # Intento 1: Procedimiento Almacenado Unificado dbo.InsertarOrdenServicioMasivaGHA
            try {
                Write-Host "  -> Invocando procedimiento unificado dbo.InsertarOrdenServicioMasivaGHA..." -ForegroundColor Cyan
                $cmdUnif = New-Object System.Data.SqlClient.SqlCommand("dbo.InsertarOrdenServicioMasivaGHA", $conn)
                $cmdUnif.CommandType = [System.Data.CommandType]::StoredProcedure
                $cmdUnif.CommandTimeout = 180

                [void]$cmdUnif.Parameters.AddWithValue("@LoginId", $loginId)
                [void]$cmdUnif.Parameters.AddWithValue("@Modificado", $nombreModificado)
                [void]$cmdUnif.Parameters.AddWithValue("@FechaOS", [DateTime]::Parse($fechaOS))
                [void]$cmdUnif.Parameters.AddWithValue("@OperadorId", $operadorId)
                [void]$cmdUnif.Parameters.AddWithValue("@DepartamentoId", 16) # GHA
                [void]$cmdUnif.Parameters.AddWithValue("@DivisionId", 12)     # NA
                [void]$cmdUnif.Parameters.AddWithValue("@DetallesJson", $detallesJson)

                $drUnif = $cmdUnif.ExecuteReader()
                if ($drUnif.Read()) {
                    $res = [int]$drUnif["Resultado"]
                    $msj = [string]$drUnif["Mensaje"]
                    $correlativo = [int]$drUnif["Correlativo"]
                    $totalInsertados = [int]$drUnif["TotalInsertados"]

                    $drUnif.Close()
                    $conn.Close()

                    if ($res -eq 1) {
                        Write-Host "  -> Inserción completada con éxito vía dbo.InsertarOrdenServicioMasivaGHA: Correlativo $correlativo" -ForegroundColor Green
                        Send-JsonResponse $response @{
                            resultado = 1
                            mensaje = "Orden de Servicio insertada exitosamente."
                            correlativo = $correlativo
                            totalInsertados = $totalInsertados
                            totalEsperados = $filas.Count
                            procedimiento = "dbo.InsertarOrdenServicioMasivaGHA"
                            errores = @()
                        }
                        $ejecutadoConExito = $true
                        continue
                    } else {
                        throw (New-Object System.Exception($msj))
                    }
                }
                $drUnif.Close()
            } catch {
                $errorProcedimientoUnificado = $_.Exception.Message
                Write-Host "  -> Procedimiento unificado devolvió: $errorProcedimientoUnificado. Evaluando fallback..." -ForegroundColor Yellow
            }

            if ($ejecutadoConExito) { continue }

            # Intento 2 (Fallback si el nuevo SP aún no ha sido desplegado en la BD): InsertarEncabezadoOS + InsertarDetalleOSGHA
            try {
                if ($conn.State -ne [System.Data.ConnectionState]::Open) {
                    $conn.Open()
                }

                $cmdEnc = New-Object System.Data.SqlClient.SqlCommand("dbo.InsertarEncabezadoOS", $conn)
                $cmdEnc.CommandType = [System.Data.CommandType]::StoredProcedure
                $cmdEnc.CommandTimeout = 120

                $totalMonto = 0.0
                foreach ($f in $filas) { $totalMonto += [double]$f.monto }

                [void]$cmdEnc.Parameters.AddWithValue("@LoginId", $loginId)
                [void]$cmdEnc.Parameters.AddWithValue("@Modificado", $nombreModificado)
                [void]$cmdEnc.Parameters.AddWithValue("@ItinerarioId", 0)
                [void]$cmdEnc.Parameters.AddWithValue("@DepartamentoId", 16) # GHA
                [void]$cmdEnc.Parameters.AddWithValue("@DivisionId", 12)     # NA
                [void]$cmdEnc.Parameters.AddWithValue("@Observaciones", "CARGA MASIVA GHA - GUIA DE IMPORTACION")
                [void]$cmdEnc.Parameters.AddWithValue("@FechaOS", [DateTime]::Parse($fechaOS))
                [void]$cmdEnc.Parameters.AddWithValue("@OperadorId", $operadorId)
                [void]$cmdEnc.Parameters.AddWithValue("@HayTaller", 0)
                [void]$cmdEnc.Parameters.AddWithValue("@MaquinariaEquipo", "")
                [void]$cmdEnc.Parameters.AddWithValue("@Marca", "")
                [void]$cmdEnc.Parameters.AddWithValue("@TipoMovilidad", 0)
                [void]$cmdEnc.Parameters.AddWithValue("@TipoMonedaId", 0)
                [void]$cmdEnc.Parameters.AddWithValue("@Total", $totalMonto.ToString("F2", [System.Globalization.CultureInfo]::InvariantCulture))
                [void]$cmdEnc.Parameters.AddWithValue("@EstaCancelado", 0)
                [void]$cmdEnc.Parameters.AddWithValue("@AreaId", 0)
                [void]$cmdEnc.Parameters.AddWithValue("@ItinerarioOperador", 0)
                [void]$cmdEnc.Parameters.AddWithValue("@FirmaCliente", "")
                [void]$cmdEnc.Parameters.AddWithValue("@FirmaEmpleado", "")
                [void]$cmdEnc.Parameters.AddWithValue("@NombreF", "")
                [void]$cmdEnc.Parameters.AddWithValue("@HayMatricula", 0)
                [void]$cmdEnc.Parameters.AddWithValue("@FBO", 0)
                [void]$cmdEnc.Parameters.AddWithValue("@EsComercial", 1)

                $drEnc = $cmdEnc.ExecuteReader()
                $correlativoCreado = 0
                if ($drEnc.Read()) {
                    $correlativoCreado = [int]$drEnc["Resultado"]
                }
                $drEnc.Close()

                if ($correlativoCreado -le 0) {
                    $conn.Close()
                    Send-JsonResponse $response @{ resultado = -1; mensaje = "No se pudo obtener el correlativo del EncabezadoOS." }
                    continue
                }

                $insertados = 0
                $errores = @()

                foreach ($fila in $filas) {
                    try {
                        $cmdDet = New-Object System.Data.SqlClient.SqlCommand("dbo.InsertarDetalleOSGHA", $conn)
                        $cmdDet.CommandType = [System.Data.CommandType]::StoredProcedure
                        $cmdDet.CommandTimeout = 60

                        [void]$cmdDet.Parameters.AddWithValue("@LoginId", $loginId)
                        [void]$cmdDet.Parameters.AddWithValue("@DepartamentoId", 16)
                        [void]$cmdDet.Parameters.AddWithValue("@CodigoServiciosId", 271) # Codigo 281
                        [void]$cmdDet.Parameters.AddWithValue("@Cantidand", 1)
                        [void]$cmdDet.Parameters.AddWithValue("@HoraInicio", "00:00")
                        [void]$cmdDet.Parameters.AddWithValue("@HoraFinal", "00:00")
                        [void]$cmdDet.Parameters.AddWithValue("@TotalDif", 1)
                        [void]$cmdDet.Parameters.AddWithValue("@Comentarios", $(if ($fila.comentarios) { [string]$fila.comentarios } else { "" }))
                        [void]$cmdDet.Parameters.AddWithValue("@KilogramosNeto", "")
                        [void]$cmdDet.Parameters.AddWithValue("@KilogramosVolumen", "")
                        [void]$cmdDet.Parameters.AddWithValue("@Monto", [decimal]$fila.monto)
                        [void]$cmdDet.Parameters.AddWithValue("@NoGuia", [string]$fila.guia)
                        [void]$cmdDet.Parameters.AddWithValue("@DivisionId", 12) # NA
                        [void]$cmdDet.Parameters.AddWithValue("@MetodoId", $(if ($fila.metodoPagoId) { [int]$fila.metodoPagoId } else { 0 }))
                        [void]$cmdDet.Parameters.AddWithValue("@NoBoleta", "")
                        [void]$cmdDet.Parameters.AddWithValue("@Depositante", "")
                        [void]$cmdDet.Parameters.AddWithValue("@FechaPago", [DateTime]::Parse($fechaOS))
                        [void]$cmdDet.Parameters.AddWithValue("@ClientesFacturacionId", 0)

                        $drDet = $cmdDet.ExecuteReader()
                        if ($drDet.Read()) {
                            $res = [int]$drDet["Resultado"]
                            if ($res -eq 1) {
                                $insertados++
                            } else {
                                $errores += "Guía $($fila.guia): $($drDet['Mensaje'])"
                            }
                        }
                        $drDet.Close()
                    } catch {
                        $errores += "Guía $($fila.guia): $($_.Exception.Message)"
                    }
                }

                $conn.Close()

                Write-Host "  -> Finalizado: $insertados de $($filas.Count) detalles insertados exitosamente." -ForegroundColor Green
                Send-JsonResponse $response @{
                    resultado = 1
                    mensaje = "Orden de Servicio insertada exitosamente."
                    correlativo = $correlativoCreado
                    totalInsertados = $insertados
                    totalEsperados = $filas.Count
                    procedimiento = "dbo.InsertarEncabezadoOS + dbo.InsertarDetalleOSGHA"
                    errores = $errores
                }
            } catch {
                if ($conn.State -eq [System.Data.ConnectionState]::Open) { $conn.Close() }
                Send-JsonResponse $response @{ resultado = -1; mensaje = "Error durante la inserción: $($_.Exception.Message)" }
            }
            continue
        }

        # Respuesta por defecto para acciones no reconocidas
        Send-JsonResponse $response @{ resultado = -1; mensaje = "Acción '$action' no reconocida" }

    } catch {
        Write-Host "Error en el ciclo del servidor: $_" -ForegroundColor Red
        if ($response -and $response.OutputStream) {
            try {
                Send-JsonResponse $response @{ resultado = -1; mensaje = $_.Exception.Message } 500
            } catch {}
        }
    }
}

