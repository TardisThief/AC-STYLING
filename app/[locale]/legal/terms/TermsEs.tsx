import { Link } from '@/i18n/routing';

/**
 * Spanish terms and conditions — a translation of ./TermsEn.tsx, which remains
 * the authoritative text. The two must say the same thing: a change to one is
 * a change to both, and a divergence between them is a legal defect, not a nit.
 *
 * Section ids (`#services`, `#refunds`, …) are deliberately NOT translated:
 * an anchor is an address, not copy, and keeping them identical means a link
 * to a clause works in either language.
 *
 * Blocks kept in the original English capitalisation (the disclaimer, the
 * limitation of liability, the termination clause) are translated but keep
 * their all-caps emphasis, because that emphasis is doing legal work under US
 * law — conspicuousness — not typographic work.
 */
export default function TermsEs() {
    return (
        <article className="prose prose-stone max-w-none prose-headings:font-serif prose-headings:text-ac-taupe prose-p:text-ac-taupe/80 prose-a:text-ac-espresso hover:prose-a:text-ac-taupe">
            <h1 className="font-serif text-4xl mb-4">TÉRMINOS Y CONDICIONES</h1>
            <p className="text-sm text-gray-500 mb-8">Última actualización: 23 de septiembre de 2026</p>

            <h2>ACEPTACIÓN DE NUESTROS TÉRMINOS LEGALES</h2>
            <p>Somos AC Styling (&quot;<strong>la Empresa</strong>&quot;, &quot;<strong>nosotros</strong>&quot; o &quot;<strong>nuestro</strong>&quot;), una empresa registrada en Florida, Estados Unidos, con domicilio en 1865 S Ocean Dr, Hallandale Beach, FL 33009.</p>
            <p>Operamos el sitio web <a href="https://www.theacstyle.com">https://www.theacstyle.com</a> (el &quot;<strong>Sitio</strong>&quot;), así como cualesquiera otros productos y servicios relacionados que remitan o enlacen a estos términos legales (los &quot;<strong>Términos Legales</strong>&quot;) (en conjunto, los &quot;<strong>Servicios</strong>&quot;).</p>
            <p>AC Styling ofrece asesoría de moda y contenido educativo en formato digital. Nuestros servicios incluyen:</p>
            <ul>
                <li><strong>Productos digitales:</strong> acceso a Masterclasses en video pregrabado, guías descargables y materiales de curso (en conjunto, &quot;El Vault&quot;).</li>
                <li><strong>Servicios de asesoría:</strong> asesoría de estilo personalizada, revisión de clóset (&quot;Detox&quot;) y servicios de curaduría, entregados por medios digitales.</li>
                <li><strong>Aviso:</strong> toda asesoría de estilo es subjetiva y tiene fines informativos y estéticos. La Clienta conserva plena discreción sobre todas sus decisiones de compra.</li>
            </ul>
            <p>Puedes contactarnos por correo electrónico en <a href="mailto:hello@theacstyle.com">hello@theacstyle.com</a> o por correo postal a 1865 S Ocean Dr, Hallandale Beach, FL 33009, Estados Unidos.</p>
            <p>Estos Términos Legales constituyen un acuerdo legalmente vinculante celebrado entre tú, ya sea a título personal o en representación de una entidad (&quot;tú&quot;), y AC Styling, en relación con tu acceso y uso de los Servicios. Aceptas que, al acceder a los Servicios, has leído, entendido y aceptado quedar obligado por todos estos Términos Legales. SI NO ESTÁS DE ACUERDO CON LA TOTALIDAD DE ESTOS TÉRMINOS LEGALES, QUEDAS EXPRESAMENTE PROHIBIDO DE USAR LOS SERVICIOS Y DEBES INTERRUMPIR SU USO DE INMEDIATO.</p>
            <p>Los términos, condiciones o documentos complementarios que se publiquen en los Servicios de tiempo en tiempo quedan expresamente incorporados aquí por referencia. Nos reservamos el derecho, a nuestra entera discreción, de realizar cambios o modificaciones a estos Términos Legales en cualquier momento. Te avisaremos de cualquier cambio actualizando la fecha de &quot;Última actualización&quot; de estos Términos Legales, y renuncias a cualquier derecho a recibir notificación específica de cada cambio. Es tu responsabilidad revisar periódicamente estos Términos Legales para mantenerte informada de las actualizaciones. Quedarás sujeta a —y se considerará que has conocido y aceptado— los cambios de cualquier versión revisada de los Términos Legales por el hecho de continuar usando los Servicios después de la fecha en que dicha versión se publique.</p>

            <h2>ÍNDICE DE CONTENIDOS</h2>
            <ol>
                <li><a href="#services">NUESTROS SERVICIOS</a></li>
                <li><a href="#ip">DERECHOS DE PROPIEDAD INTELECTUAL</a></li>
                <li><a href="#userreps">DECLARACIONES DEL USUARIO</a></li>
                <li><a href="#userreg">REGISTRO DE USUARIO</a></li>
                <li><a href="#products">PRODUCTOS</a></li>
                <li><a href="#purchases">COMPRAS Y PAGOS</a></li>
                <li><a href="#refunds">POLÍTICA DE REEMBOLSOS</a></li>
                <li><a href="#prohibited">ACTIVIDADES PROHIBIDAS</a></li>
                <li><a href="#ugc">CONTRIBUCIONES GENERADAS POR EL USUARIO</a></li>
                <li><a href="#contribution">LICENCIA SOBRE LAS CONTRIBUCIONES</a></li>
                <li><a href="#thirdparty">SITIOS Y CONTENIDOS DE TERCEROS</a></li>
                <li><a href="#management">GESTIÓN DE LOS SERVICIOS</a></li>
                <li><a href="#privacypolicy">POLÍTICA DE PRIVACIDAD</a></li>
                <li><a href="#copyright">INFRACCIONES DE DERECHOS DE AUTOR</a></li>
                <li><a href="#term">VIGENCIA Y TERMINACIÓN</a></li>
                <li><a href="#modifications">MODIFICACIONES E INTERRUPCIONES</a></li>
                <li><a href="#law">LEY APLICABLE</a></li>
                <li><a href="#disputes">RESOLUCIÓN DE CONTROVERSIAS</a></li>
                <li><a href="#corrections">CORRECCIONES</a></li>
                <li><a href="#disclaimer">EXENCIÓN DE RESPONSABILIDAD</a></li>
                <li><a href="#liability">LIMITACIONES DE RESPONSABILIDAD</a></li>
                <li><a href="#indemnification">INDEMNIZACIÓN</a></li>
                <li><a href="#userdata">DATOS DEL USUARIO</a></li>
                <li><a href="#electronic">COMUNICACIONES, TRANSACCIONES Y FIRMAS ELECTRÓNICAS</a></li>
                <li><a href="#california">USUARIOS Y RESIDENTES DE CALIFORNIA</a></li>
                <li><a href="#misc">DISPOSICIONES VARIAS</a></li>
                <li><a href="#contact">CONTÁCTANOS</a></li>
            </ol>

            <h2 id="services">1. NUESTROS SERVICIOS</h2>
            <p>La información proporcionada al usar los Servicios no está destinada a ser distribuida ni usada por ninguna persona o entidad en ninguna jurisdicción o país donde dicha distribución o uso sea contrario a la ley o a la normativa, o que nos someta a algún requisito de registro dentro de esa jurisdicción o país. En consecuencia, quienes elijan acceder a los Servicios desde otras ubicaciones lo hacen por iniciativa propia y son responsables exclusivas del cumplimiento de las leyes locales, si y en la medida en que estas resulten aplicables.</p>
            <p>Los Servicios no están adaptados para cumplir normativas sectoriales específicas (la Health Insurance Portability and Accountability Act (HIPAA), la Federal Information Security Management Act (FISMA), etc.), por lo que si tus interacciones estuvieran sujetas a dichas leyes, no puedes usar los Servicios. No puedes usar los Servicios de una forma que infrinja la Gramm-Leach-Bliley Act (GLBA).</p>

            <h2 id="ip">2. DERECHOS DE PROPIEDAD INTELECTUAL</h2>
            <h3>Nuestra propiedad intelectual</h3>
            <p>Somos titulares o licenciatarios de todos los derechos de propiedad intelectual sobre nuestros Servicios, incluidos todo el código fuente, bases de datos, funcionalidades, software, diseños del sitio web, audio, video, texto, fotografías y gráficos contenidos en los Servicios (en conjunto, el &quot;Contenido&quot;), así como las marcas comerciales, marcas de servicio y logotipos contenidos en ellos (las &quot;Marcas&quot;).</p>
            <p>Nuestro Contenido y nuestras Marcas están protegidos por las leyes de derechos de autor y de marcas (y por diversos otros derechos de propiedad intelectual y leyes de competencia desleal) y por tratados en Estados Unidos y en todo el mundo.</p>
            <p>El Contenido y las Marcas se proporcionan en o a través de los Servicios &quot;TAL CUAL&quot;, únicamente para tu uso personal y no comercial.</p>
            <h3>Tu uso de nuestros Servicios</h3>
            <p>Sujeto a tu cumplimiento de estos Términos Legales, incluida la sección &quot;ACTIVIDADES PROHIBIDAS&quot; más abajo, te otorgamos una licencia no exclusiva, intransferible y revocable para:</p>
            <ul>
                <li>acceder a los Servicios; y</li>
                <li>descargar o imprimir una copia de cualquier parte del Contenido a la que hayas accedido debidamente,</li>
            </ul>
            <p>únicamente para tu uso personal y no comercial.</p>
            <p>Salvo lo establecido en esta sección o en otra parte de nuestros Términos Legales, ninguna parte de los Servicios ni del Contenido o las Marcas podrá ser copiada, reproducida, agregada, republicada, cargada, publicada, exhibida públicamente, codificada, traducida, transmitida, distribuida, vendida, licenciada o explotada de cualquier otro modo con fines comerciales, sin nuestro permiso previo y expreso por escrito.</p>
            <h3>Tus envíos y contribuciones</h3>
            <p>Revisa con atención esta sección y la sección &quot;ACTIVIDADES PROHIBIDAS&quot; antes de usar nuestros Servicios, para comprender (a) los derechos que nos otorgas y (b) las obligaciones que asumes cuando publicas o cargas contenido a través de los Servicios.</p>
            <p><strong>Envíos:</strong> al enviarnos directamente cualquier pregunta, comentario, sugerencia, idea, opinión u otra información sobre los Servicios (los &quot;Envíos&quot;), aceptas cedernos todos los derechos de propiedad intelectual sobre dicho Envío. Aceptas que dicho Envío será de nuestra propiedad y que tendremos derecho a su uso y difusión sin restricciones para cualquier fin lícito, comercial o de otro tipo, sin reconocimiento ni compensación para ti.</p>
            <p><strong>Contribuciones:</strong> los Servicios pueden invitarte a chatear, contribuir o participar en blogs, tableros de mensajes, foros en línea y otras funcionalidades durante las cuales podrías crear, enviar, publicar, exhibir, transmitir, difundir o distribuir contenidos y materiales hacia nosotros o a través de los Servicios (las &quot;Contribuciones&quot;). Todo Envío que se publique públicamente será tratado también como una Contribución.</p>
            <p>Cuando publicas Contribuciones, nos otorgas una licencia (incluido el uso de tu nombre, marcas y logotipos). Al publicar cualquier Contribución, nos otorgas un derecho y una licencia sin restricciones, ilimitados, irrevocables, perpetuos, no exclusivos, transferibles, libres de regalías, totalmente pagados y de alcance mundial para usar, copiar, reproducir, distribuir, vender, revender, publicar, difundir, retitular, almacenar, ejecutar públicamente, exhibir públicamente, reformatear, traducir, extractar y explotar tus Contribuciones.</p>
            <p>Eres responsable de lo que publicas o cargas.</p>
            <h3>Infracción de derechos de autor</h3>
            <p>Respetamos los derechos de propiedad intelectual de terceros. Si consideras que algún material disponible en o a través de los Servicios infringe algún derecho de autor de tu titularidad o bajo tu control, consulta la sección &quot;INFRACCIONES DE DERECHOS DE AUTOR&quot; más abajo.</p>

            <h2 id="userreps">3. DECLARACIONES DEL USUARIO</h2>
            <p>Al usar los Servicios, declaras y garantizas que: (1) toda la información de registro que envíes será veraz, exacta, vigente y completa; (2) mantendrás la exactitud de dicha información y la actualizarás con prontitud cuando sea necesario; (3) tienes capacidad legal y aceptas cumplir estos Términos Legales; (4) no eres menor de 13 años; (5) no eres menor de edad en la jurisdicción en la que resides o, si lo eres, cuentas con permiso de tus padres o tutores para usar los Servicios; (6) no accederás a los Servicios por medios automatizados o no humanos; (7) no usarás los Servicios para ningún fin ilegal o no autorizado; y (8) tu uso de los Servicios no infringirá ninguna ley o normativa aplicable.</p>

            <h2 id="userreg">4. REGISTRO DE USUARIO</h2>
            <p>Es posible que debas registrarte para usar los Servicios. Aceptas mantener tu contraseña en confidencialidad y serás responsable de todo uso de tu cuenta y contraseña. Nos reservamos el derecho de eliminar, reclamar o cambiar el nombre de usuario que elijas si determinamos, a nuestra entera discreción, que dicho nombre de usuario resulta inapropiado.</p>

            <h2 id="products">5. PRODUCTOS</h2>
            <p>Todos los productos están sujetos a disponibilidad. Nos reservamos el derecho de descontinuar cualquier producto en cualquier momento y por cualquier motivo. Los precios de todos los productos están sujetos a cambio.</p>

            <h2 id="purchases">6. COMPRAS Y PAGOS</h2>
            <p>Aceptamos las siguientes formas de pago:</p>
            <ul>
                <li>Visa</li>
                <li>Mastercard</li>
                <li>Stripe Checkouts</li>
            </ul>
            <p>Aceptas proporcionar información de compra y de cuenta vigente, completa y exacta para todas las compras realizadas a través de los Servicios. Todos los pagos se efectuarán en dólares estadounidenses.</p>
            <p>Nos reservamos el derecho de rechazar cualquier pedido realizado a través de los Servicios. Podemos, a nuestra entera discreción, limitar o cancelar las cantidades adquiridas por persona, por hogar o por pedido.</p>

            <p><strong>Vigencia del acceso al Vault.</strong> Salvo que se indique otra cosa en el momento de la compra, el acceso al Vault —ya sea un pase o una masterclass individual— se otorga por un plazo de un (1) año contado desde la fecha de compra. El acceso termina automáticamente al concluir ese plazo. No se trata de una suscripción: no se te cobra nada de forma automática y no se realiza ningún cargo salvo que decidas renovar.</p>
            <p><strong>Precio de renovación.</strong> Si renuevas, el precio se calcula sobre el importe que pagaste en tu compra más reciente del mismo producto que no haya sido una renovación: dos tercios (2/3) de ese importe en tu primera renovación y un tercio (1/3) en cada renovación posterior. Renovar antes de que termine tu plazo añade un año más a tu fecha de vencimiento vigente, de modo que no pierdes el tiempo que te quede por renovar antes.</p>
            <p><strong>Vencimiento sin renovación.</strong> La renovación al precio descrito arriba sigue disponible durante treinta (30) días después de que termine tu plazo. Ese periodo conserva únicamente el precio de renovación; el acceso termina en la fecha de vencimiento. Si no has renovado al concluir esos treinta días, el precio de renovación deja de aplicarse y cualquier compra posterior se realiza al precio vigente en ese momento y se considera una nueva compra de primer año a efectos del cálculo descrito arriba.</p>
            <p>El acceso otorgado antes de la introducción de este plazo, y cualquier acceso que te concedamos sin costo, no está sujeto a él.</p>

            <h2 id="refunds">7. POLÍTICA DE REEMBOLSOS</h2>
            <p>Todas las ventas son definitivas y no se emitirá ningún reembolso.</p>

            <h2 id="prohibited">8. ACTIVIDADES PROHIBIDAS</h2>
            <p>No puedes acceder ni usar los Servicios para ningún fin distinto de aquel para el que los ponemos a disposición. Los Servicios no pueden usarse en relación con actividades comerciales, salvo aquellas que respaldemos o aprobemos específicamente.</p>
            <p>Como usuaria de los Servicios, aceptas no:</p>
            <ul>
                <li>Extraer sistemáticamente datos u otros contenidos de los Servicios sin nuestro permiso por escrito.</li>
                <li>Engañar, defraudar o inducir a error a nosotros o a otros usuarios.</li>
                <li>Eludir, deshabilitar o interferir de cualquier otro modo con las funciones de seguridad de los Servicios.</li>
                <li>Denigrar, empañar o dañar de cualquier otro modo a nosotros y/o a los Servicios.</li>
                <li>Usar cualquier información obtenida de los Servicios para hostigar, abusar o dañar a otra persona.</li>
                <li>Hacer un uso indebido de nuestros servicios de soporte o presentar informes falsos de abuso o mala conducta.</li>
                <li>Usar los Servicios de manera incompatible con cualquier ley o normativa aplicable.</li>
                <li>Realizar framing o enlaces no autorizados hacia los Servicios.</li>
                <li>Cargar o transmitir virus, troyanos u otro material que interfiera con el uso y disfrute ininterrumpido de cualquier parte.</li>
                <li>Realizar cualquier uso automatizado del sistema.</li>
                <li>Eliminar el aviso de derechos de autor u otros derechos de propiedad de cualquier Contenido.</li>
                <li>Intentar suplantar la identidad de otro usuario o persona.</li>
                <li>Cargar o transmitir material que actúe como mecanismo pasivo o activo de recopilación de información (por ejemplo, spyware).</li>
                <li>Interferir con, interrumpir o generar una carga indebida sobre los Servicios.</li>
                <li>Hostigar, molestar, intimidar o amenazar a cualquiera de nuestras personas empleadas.</li>
                <li>Intentar eludir cualquier medida de los Servicios destinada a impedir o restringir el acceso.</li>
                <li>Copiar o adaptar el software de los Servicios.</li>
                <li>Descifrar, descompilar, desensamblar o realizar ingeniería inversa sobre cualquier software que integre los Servicios.</li>
                <li>Usar un agente de compra para realizar compras en los Servicios.</li>
                <li>Hacer cualquier uso no autorizado de los Servicios, incluida la recopilación de nombres de usuario y/o direcciones de correo electrónico.</li>
                <li>Usar los Servicios para cualquier actividad generadora de ingresos o empresa comercial.</li>
                <li>Vender o transferir de cualquier otro modo tu perfil.</li>
                <li>Usar los Servicios para anunciar u ofrecer la venta de bienes y servicios.</li>
                <li>Compartir o distribuir los contenidos del sitio.</li>
            </ul>

            <h2 id="ugc">9. CONTRIBUCIONES GENERADAS POR EL USUARIO</h2>
            <p>Los Servicios pueden invitarte a chatear, contribuir o participar en blogs, tableros de mensajes, foros en línea y otras funcionalidades. Las Contribuciones pueden ser visibles para otros usuarios de los Servicios y a través de sitios web de terceros. Cuando creas o pones a disposición cualquier Contribución, declaras y garantizas que no infringe derechos de propiedad, que cuentas con las licencias necesarias y que no es falsa, inexacta ni engañosa.</p>

            <h2 id="contribution">10. LICENCIA SOBRE LAS CONTRIBUCIONES</h2>
            <p>Al publicar tus Contribuciones en cualquier parte de los Servicios, nos otorgas automáticamente un derecho y una licencia sin restricciones, ilimitados, irrevocables, perpetuos, no exclusivos, transferibles, libres de regalías, totalmente pagados y de alcance mundial para alojar, usar, copiar, reproducir, divulgar, vender, revender, publicar, difundir, retitular, archivar, almacenar, guardar en caché, ejecutar públicamente, exhibir públicamente, reformatear, traducir, transmitir, extractar y distribuir dichas Contribuciones.</p>

            <h2 id="thirdparty">11. SITIOS Y CONTENIDOS DE TERCEROS</h2>
            <p>Los Servicios pueden contener enlaces a otros sitios web (los &quot;Sitios de Terceros&quot;), así como artículos, fotografías, texto, gráficos, imágenes, diseños, música, sonido, video, información, aplicaciones, software y otros contenidos o elementos pertenecientes a terceros o provenientes de ellos (el &quot;Contenido de Terceros&quot;). No somos responsables de ningún Sitio de Terceros al que se acceda a través de los Servicios ni de ningún Contenido de Terceros publicado en, disponible a través de, o instalado desde los Servicios.</p>

            <h2 id="management">12. GESTIÓN DE LOS SERVICIOS</h2>
            <p>Nos reservamos el derecho, pero no la obligación, de: (1) supervisar los Servicios en busca de infracciones a estos Términos Legales; (2) emprender las acciones legales que correspondan contra quien infrinja la ley o estos Términos Legales; (3) rechazar, restringir el acceso a, limitar la disponibilidad de, o deshabilitar cualquiera de tus Contribuciones; (4) eliminar de los Servicios o deshabilitar de otro modo todos los archivos y contenidos de tamaño excesivo; y (5) gestionar de cualquier otra forma los Servicios de manera diseñada para proteger nuestros derechos y nuestra propiedad.</p>

            <h2 id="privacypolicy">13. POLÍTICA DE PRIVACIDAD</h2>
            <p>Nos importan la privacidad y la seguridad de los datos. Consulta nuestro <Link href="/legal/privacy">Aviso de Privacidad</Link>. Al usar los Servicios, aceptas quedar obligada por nuestro Aviso de Privacidad, que queda incorporado a estos Términos Legales. Te informamos que los Servicios están alojados en Estados Unidos.</p>

            <h2 id="copyright">14. INFRACCIONES DE DERECHOS DE AUTOR</h2>
            <p>Respetamos los derechos de propiedad intelectual de terceros. Si consideras que algún material disponible en o a través de los Servicios infringe algún derecho de autor de tu titularidad o bajo tu control, notifícanoslo de inmediato usando los datos de contacto que aparecen más abajo (una &quot;Notificación&quot;). Se enviará una copia de tu Notificación a la persona que publicó o almacenó el material al que se refiere. Ten en cuenta que, conforme a la ley aplicable, podrías ser responsable de daños si realizas declaraciones materialmente falsas en una Notificación. Por ello, si no estás segura de que el material ubicado en —o enlazado desde— los Servicios infringe tus derechos de autor, deberías considerar consultar primero con un abogado.</p>

            <h2 id="term">15. VIGENCIA Y TERMINACIÓN</h2>
            <p>Estos Términos Legales permanecerán en pleno vigor y efecto mientras uses los Servicios. SIN LIMITAR NINGUNA OTRA DISPOSICIÓN DE ESTOS TÉRMINOS LEGALES, NOS RESERVAMOS EL DERECHO DE, A NUESTRA ENTERA DISCRECIÓN Y SIN AVISO NI RESPONSABILIDAD, DENEGAR EL ACCESO Y EL USO DE LOS SERVICIOS (INCLUIDO EL BLOQUEO DE DETERMINADAS DIRECCIONES IP) A CUALQUIER PERSONA, POR CUALQUIER MOTIVO O SIN MOTIVO ALGUNO, INCLUIDO, SIN LIMITACIÓN, EL INCUMPLIMIENTO DE CUALQUIER DECLARACIÓN, GARANTÍA O COMPROMISO CONTENIDO EN ESTOS TÉRMINOS LEGALES O DE CUALQUIER LEY O NORMATIVA APLICABLE. PODEMOS DAR POR TERMINADO TU USO O PARTICIPACIÓN EN LOS SERVICIOS, O ELIMINAR TU CUENTA Y CUALQUIER CONTENIDO O INFORMACIÓN QUE HAYAS PUBLICADO, EN CUALQUIER MOMENTO, SIN AVISO Y A NUESTRA ENTERA DISCRECIÓN.</p>
            <p>Si damos por terminada o suspendemos tu cuenta por cualquier motivo, queda prohibido que te registres y crees una cuenta nueva bajo tu nombre, un nombre falso o prestado, o el nombre de un tercero, incluso si actúas en representación de dicho tercero. Además de terminar o suspender tu cuenta, nos reservamos el derecho de emprender las acciones legales que correspondan, incluida, sin limitación, la vía civil, penal y de medidas cautelares.</p>

            <h2 id="modifications">16. MODIFICACIONES E INTERRUPCIONES</h2>
            <p>Nos reservamos el derecho de cambiar, modificar o eliminar los contenidos de los Servicios en cualquier momento y por cualquier motivo, a nuestra entera discreción y sin aviso. Sin embargo, no tenemos obligación de actualizar ninguna información de nuestros Servicios. También nos reservamos el derecho de modificar o descontinuar la totalidad o parte de los Servicios en cualquier momento y sin aviso. No seremos responsables ante ti ni ante terceros por ninguna modificación, cambio de precio, suspensión o descontinuación de los Servicios.</p>
            <p>No podemos garantizar que los Servicios estén disponibles en todo momento. Podemos experimentar problemas de hardware, software u otros, o necesitar realizar tareas de mantenimiento relacionadas con los Servicios, lo que puede provocar interrupciones, retrasos o errores. Nos reservamos el derecho de cambiar, revisar, actualizar, suspender, descontinuar o modificar de cualquier otro modo los Servicios en cualquier momento y por cualquier motivo, sin aviso previo. Aceptas que no tenemos responsabilidad alguna por cualquier pérdida, daño o inconveniente causado por tu imposibilidad de acceder o usar los Servicios durante cualquier periodo de inactividad o descontinuación. Nada en estos Términos Legales se interpretará como una obligación nuestra de mantener y dar soporte a los Servicios ni de suministrar correcciones, actualizaciones o versiones relacionadas.</p>

            <h2 id="law">17. LEY APLICABLE</h2>
            <p>Estos Términos Legales y tu uso de los Servicios se rigen e interpretan conforme a las leyes del Estado de Florida aplicables a los acuerdos celebrados y ejecutados íntegramente dentro del Estado de Florida, sin atender a sus principios de conflicto de leyes.</p>

            <h2 id="disputes">18. RESOLUCIÓN DE CONTROVERSIAS</h2>
            <h3>Negociaciones informales</h3>
            <p>Para agilizar la resolución y controlar el costo de cualquier disputa, controversia o reclamación relacionada con estos Términos Legales (cada una, una &quot;Disputa&quot; y, en conjunto, las &quot;Disputas&quot;) presentada por ti o por nosotros (individualmente, una &quot;Parte&quot; y, en conjunto, las &quot;Partes&quot;), las Partes acuerdan intentar primero negociar cualquier Disputa (salvo aquellas expresamente previstas más abajo) de forma informal durante al menos treinta (30) días antes de iniciar un arbitraje. Dichas negociaciones informales comienzan con la notificación por escrito de una Parte a la otra.</p>
            <h3>Arbitraje vinculante</h3>
            <p>Si las Partes no logran resolver una Disputa mediante negociaciones informales, la Disputa (salvo aquellas expresamente excluidas más abajo) se resolverá de forma definitiva y exclusiva mediante arbitraje vinculante. ENTIENDES QUE, SIN ESTA DISPOSICIÓN, TENDRÍAS DERECHO A DEMANDAR ANTE UN TRIBUNAL Y A UN JUICIO POR JURADO. El arbitraje se iniciará y se llevará a cabo conforme a las Reglas de Arbitraje Comercial de la American Arbitration Association (&quot;AAA&quot;) y, cuando corresponda, a los Procedimientos Suplementarios para Disputas de Consumo de la AAA (&quot;Reglas de Consumo de la AAA&quot;), ambos disponibles en el sitio web de la American Arbitration Association (AAA). Tus honorarios de arbitraje y tu parte de la compensación del árbitro se regirán por las Reglas de Consumo de la AAA y, cuando corresponda, estarán limitados por ellas. El arbitraje podrá realizarse de forma presencial, mediante la presentación de documentos, por teléfono o en línea. El árbitro emitirá su decisión por escrito, pero no estará obligado a motivarla salvo que alguna de las Partes lo solicite. El árbitro debe aplicar la ley aplicable y cualquier laudo podrá impugnarse si no lo hace. Salvo que las reglas de la AAA aplicables o la ley aplicable exijan otra cosa, el arbitraje tendrá lugar en Broward, Florida. Salvo que aquí se disponga otra cosa, las Partes podrán acudir a los tribunales para compeler el arbitraje, suspender procedimientos en tanto se resuelve el arbitraje, o confirmar, modificar, anular o ejecutar el laudo dictado por el árbitro.</p>
            <p>Si por cualquier motivo una Disputa se tramita ante los tribunales en lugar de arbitraje, la Disputa se iniciará o litigará ante los tribunales estatales y federales ubicados en Broward, Florida, y las Partes consienten en ello y renuncian a todas las defensas de falta de jurisdicción personal y de forum non conveniens respecto de la competencia territorial y la jurisdicción de dichos tribunales estatales y federales. Queda excluida de estos Términos Legales la aplicación de la Convención de las Naciones Unidas sobre los Contratos de Compraventa Internacional de Mercaderías y de la Uniform Computer Information Transaction Act (UCITA).</p>
            <p>En ningún caso podrá iniciarse una Disputa presentada por cualquiera de las Partes y relacionada de algún modo con los Servicios transcurrido más de un (1) año desde que surgió la causa de la acción. Si se determina que esta disposición es ilegal o inexigible, ninguna de las Partes optará por arbitrar ninguna Disputa comprendida en la parte de esta disposición que se haya declarado ilegal o inexigible, y dicha Disputa será resuelta por un tribunal competente de entre los indicados arriba, y las Partes aceptan someterse a la jurisdicción personal de dicho tribunal.</p>
            <h3>Restricciones</h3>
            <p>Las Partes acuerdan que todo arbitraje se limitará a la Disputa entre las Partes individualmente. En la máxima medida permitida por la ley: (a) ningún arbitraje se acumulará con ningún otro procedimiento; (b) no existe derecho ni facultad para que una Disputa se arbitre como acción colectiva ni para emplear procedimientos de acción colectiva; y (c) no existe derecho ni facultad para que una Disputa se presente en supuesta representación del público en general o de cualesquiera otras personas.</p>
            <h3>Excepciones a las negociaciones informales y al arbitraje</h3>
            <p>Las Partes acuerdan que las siguientes Disputas no están sujetas a las disposiciones anteriores sobre negociaciones informales y arbitraje vinculante: (a) las Disputas que busquen hacer valer o proteger, o que versen sobre la validez de, cualquiera de los derechos de propiedad intelectual de una Parte; (b) las Disputas relacionadas con, o derivadas de, alegaciones de robo, piratería, invasión de la privacidad o uso no autorizado; y (c) cualquier reclamación de medidas cautelares. Si se determina que esta disposición es ilegal o inexigible, ninguna de las Partes optará por arbitrar ninguna Disputa comprendida en la parte de esta disposición que se haya declarado ilegal o inexigible, y dicha Disputa será resuelta por un tribunal competente de entre los indicados arriba, y las Partes aceptan someterse a la jurisdicción personal de dicho tribunal.</p>

            <h2 id="corrections">19. CORRECCIONES</h2>
            <p>Puede haber información en los Servicios que contenga errores tipográficos, inexactitudes u omisiones, incluidas descripciones, precios, disponibilidad y otros datos. Nos reservamos el derecho de corregir cualquier error, inexactitud u omisión y de cambiar o actualizar la información de los Servicios en cualquier momento, sin aviso previo.</p>

            <h2 id="disclaimer">20. EXENCIÓN DE RESPONSABILIDAD</h2>
            <p>LOS SERVICIOS SE PROPORCIONAN &quot;TAL CUAL&quot; Y &quot;SEGÚN DISPONIBILIDAD&quot;. ACEPTAS QUE EL USO DE LOS SERVICIOS SERÁ BAJO TU EXCLUSIVO RIESGO. EN LA MÁXIMA MEDIDA PERMITIDA POR LA LEY, RECHAZAMOS TODAS LAS GARANTÍAS, EXPRESAS O IMPLÍCITAS, EN RELACIÓN CON LOS SERVICIOS Y TU USO DE ELLOS, INCLUIDAS, SIN LIMITACIÓN, LAS GARANTÍAS IMPLÍCITAS DE COMERCIABILIDAD, IDONEIDAD PARA UN FIN DETERMINADO Y NO INFRACCIÓN. NO OFRECEMOS GARANTÍA NI DECLARACIÓN ALGUNA SOBRE LA EXACTITUD O INTEGRIDAD DEL CONTENIDO DE LOS SERVICIOS NI DEL CONTENIDO DE CUALQUIER SITIO WEB O APLICACIÓN MÓVIL ENLAZADA A LOS SERVICIOS, Y NO ASUMIREMOS RESPONSABILIDAD ALGUNA POR: (1) ERRORES, EQUIVOCACIONES O INEXACTITUDES DEL CONTENIDO Y LOS MATERIALES; (2) LESIONES PERSONALES O DAÑOS MATERIALES, DE CUALQUIER NATURALEZA, DERIVADOS DE TU ACCESO Y USO DE LOS SERVICIOS; (3) CUALQUIER ACCESO O USO NO AUTORIZADO DE NUESTROS SERVIDORES SEGUROS Y/O DE TODA LA INFORMACIÓN PERSONAL Y/O FINANCIERA ALMACENADA EN ELLOS; (4) CUALQUIER INTERRUPCIÓN O CESE DE LA TRANSMISIÓN HACIA O DESDE LOS SERVICIOS; (5) CUALQUIER FALLO, VIRUS, TROYANO O SIMILAR QUE UN TERCERO PUEDA TRANSMITIR HACIA O A TRAVÉS DE LOS SERVICIOS; Y/O (6) CUALQUIER ERROR U OMISIÓN EN EL CONTENIDO Y LOS MATERIALES, O CUALQUIER PÉRDIDA O DAÑO DE CUALQUIER TIPO DERIVADO DEL USO DE CUALQUIER CONTENIDO PUBLICADO, TRANSMITIDO O PUESTO A DISPOSICIÓN DE OTRO MODO A TRAVÉS DE LOS SERVICIOS. NO GARANTIZAMOS, RESPALDAMOS NI ASUMIMOS RESPONSABILIDAD POR NINGÚN PRODUCTO O SERVICIO ANUNCIADO U OFRECIDO POR UN TERCERO A TRAVÉS DE LOS SERVICIOS, DE CUALQUIER SITIO WEB ENLAZADO, O DE CUALQUIER SITIO WEB O APLICACIÓN MÓVIL QUE APAREZCA EN UN BANNER U OTRA PUBLICIDAD, Y NO SEREMOS PARTE NI SEREMOS RESPONSABLES EN MODO ALGUNO DE SUPERVISAR NINGUNA TRANSACCIÓN ENTRE TÚ Y CUALESQUIERA PROVEEDORES TERCEROS DE PRODUCTOS O SERVICIOS. AL IGUAL QUE CON LA COMPRA DE UN PRODUCTO O SERVICIO POR CUALQUIER MEDIO O EN CUALQUIER ENTORNO, DEBES USAR TU MEJOR CRITERIO Y ACTUAR CON PRECAUCIÓN CUANDO CORRESPONDA.</p>

            <h2 id="liability">21. LIMITACIONES DE RESPONSABILIDAD</h2>
            <p>EN NINGÚN CASO NOSOTROS NI NUESTROS DIRECTIVOS, PERSONAS EMPLEADAS O AGENTES SEREMOS RESPONSABLES ANTE TI NI ANTE NINGÚN TERCERO POR DAÑOS DIRECTOS, INDIRECTOS, CONSECUENTES, EJEMPLARES, INCIDENTALES, ESPECIALES O PUNITIVOS, INCLUIDOS LA PÉRDIDA DE BENEFICIOS, LA PÉRDIDA DE INGRESOS, LA PÉRDIDA DE DATOS U OTROS DAÑOS DERIVADOS DE TU USO DE LOS SERVICIOS, INCLUSO SI SE NOS HUBIERA ADVERTIDO DE LA POSIBILIDAD DE DICHOS DAÑOS. NO OBSTANTE CUALQUIER DISPOSICIÓN EN CONTRARIO AQUÍ CONTENIDA, NUESTRA RESPONSABILIDAD FRENTE A TI POR CUALQUIER CAUSA Y CON INDEPENDENCIA DE LA FORMA DE LA ACCIÓN ESTARÁ LIMITADA EN TODO MOMENTO AL IMPORTE QUE, EN SU CASO, NOS HAYAS PAGADO. DETERMINADAS LEYES ESTATALES DE EE. UU. Y LEYES INTERNACIONALES NO PERMITEN LIMITACIONES A LAS GARANTÍAS IMPLÍCITAS NI LA EXCLUSIÓN O LIMITACIÓN DE CIERTOS DAÑOS. SI DICHAS LEYES TE RESULTAN APLICABLES, ALGUNAS O TODAS LAS EXENCIONES O LIMITACIONES ANTERIORES PODRÍAN NO APLICARTE, Y PODRÍAS TENER DERECHOS ADICIONALES.</p>

            <h2 id="indemnification">22. INDEMNIZACIÓN</h2>
            <p>Aceptas defender, indemnizar y mantener indemnes a nosotros, incluidas nuestras subsidiarias, afiliadas y todos nuestros respectivos directivos, agentes, socios y personas empleadas, frente a cualquier pérdida, daño, responsabilidad, reclamación o demanda, incluidos los honorarios y gastos razonables de abogados, presentada por un tercero como consecuencia de o derivada de: (1) tus Contribuciones; (2) el uso de los Servicios; (3) el incumplimiento de estos Términos Legales; (4) cualquier incumplimiento de tus declaraciones y garantías establecidas en estos Términos Legales; (5) tu violación de los derechos de un tercero, incluidos, entre otros, los derechos de propiedad intelectual; o (6) cualquier acto manifiestamente dañino hacia cualquier otra usuaria de los Servicios con quien te hayas relacionado a través de ellos. No obstante lo anterior, nos reservamos el derecho, a tu costa, de asumir la defensa y el control exclusivos de cualquier asunto respecto del cual debas indemnizarnos, y aceptas cooperar, a tu costa, con nuestra defensa de dichas reclamaciones. Haremos esfuerzos razonables para notificarte cualquier reclamación, acción o procedimiento sujeto a esta indemnización en cuanto tengamos conocimiento de él.</p>

            <h2 id="userdata">23. DATOS DEL USUARIO</h2>
            <p>Conservaremos ciertos datos que transmitas a los Servicios con el fin de gestionar su funcionamiento, así como datos relativos a tu uso de los Servicios. Aunque realizamos copias de seguridad periódicas y rutinarias, eres la única responsable de todos los datos que transmitas o que se relacionen con cualquier actividad que hayas realizado usando los Servicios. Aceptas que no tendremos responsabilidad alguna ante ti por la pérdida o corrupción de dichos datos, y por la presente renuncias a cualquier acción contra nosotros derivada de dicha pérdida o corrupción.</p>

            <h2 id="electronic">24. COMUNICACIONES, TRANSACCIONES Y FIRMAS ELECTRÓNICAS</h2>
            <p>Visitar los Servicios, enviarnos correos electrónicos y completar formularios en línea constituyen comunicaciones electrónicas. Consientes recibir comunicaciones electrónicas y aceptas que todos los acuerdos, avisos, divulgaciones y otras comunicaciones que te proporcionemos electrónicamente, por correo electrónico y en los Servicios, satisfacen cualquier requisito legal de que dicha comunicación conste por escrito. POR LA PRESENTE ACEPTAS EL USO DE FIRMAS, CONTRATOS, PEDIDOS Y OTROS REGISTROS ELECTRÓNICOS, ASÍ COMO LA ENTREGA ELECTRÓNICA DE AVISOS, POLÍTICAS Y REGISTROS DE TRANSACCIONES INICIADAS O COMPLETADAS POR NOSOTROS O A TRAVÉS DE LOS SERVICIOS. Por la presente renuncias a cualesquiera derechos o requisitos previstos en estatutos, reglamentos, normas, ordenanzas u otras leyes de cualquier jurisdicción que exijan una firma original, o la entrega o conservación de registros no electrónicos, o que los pagos o la concesión de créditos se realicen por medios distintos de los electrónicos.</p>

            <h2 id="california">25. USUARIOS Y RESIDENTES DE CALIFORNIA</h2>
            <p>Si alguna queja presentada ante nosotros no se resuelve satisfactoriamente, puedes contactar a la Complaint Assistance Unit de la Division of Consumer Services del California Department of Consumer Affairs por escrito en 1625 North Market Blvd., Suite N 112, Sacramento, California 95834, o por teléfono al (800) 952-5210 o al (916) 445-1254.</p>

            <h2 id="misc">26. DISPOSICIONES VARIAS</h2>
            <p>Estos Términos Legales y cualesquiera políticas o reglas de operación que publiquemos en los Servicios o respecto de ellos constituyen el acuerdo y el entendimiento íntegros entre tú y nosotros. El hecho de que no ejerzamos o hagamos valer algún derecho o disposición de estos Términos Legales no operará como renuncia a dicho derecho o disposición. Estos Términos Legales operan en la máxima medida permitida por la ley. Podemos ceder cualquiera o todos nuestros derechos y obligaciones a terceros en cualquier momento. No seremos responsables de ninguna pérdida, daño, retraso o falta de actuación causada por cualquier motivo que escape a nuestro control razonable. Si se determina que alguna disposición o parte de una disposición de estos Términos Legales es ilícita, nula o inexigible, dicha disposición o parte se considerará separable de estos Términos Legales y no afectará la validez ni la exigibilidad de las disposiciones restantes. No se crea ninguna relación de empresa conjunta, sociedad, empleo o agencia entre tú y nosotros como resultado de estos Términos Legales o del uso de los Servicios. Aceptas que estos Términos Legales no se interpretarán en nuestra contra por el hecho de haberlos redactado. Por la presente renuncias a todas y cada una de las defensas que pudieras tener basadas en la forma electrónica de estos Términos Legales y en la falta de firma de las partes para su celebración.</p>

            <h2 id="contact">27. CONTÁCTANOS</h2>
            <p>Para resolver una queja relativa a los Servicios o para recibir más información sobre su uso, contáctanos en:</p>
            <p>
                AC Styling<br />
                1865 S Ocean Dr<br />
                Hallandale Beach, FL 33009<br />
                Estados Unidos<br />
                <a href="mailto:hello@theacstyle.com">hello@theacstyle.com</a>
            </p>
        </article>
    );
}
