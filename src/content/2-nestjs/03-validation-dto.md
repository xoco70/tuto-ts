---
id: nest-validation
track: nestjs
order: 3
title: DTO, validation et sérialisation
level: Intermédiaire
summary: ValidationPipe et ses options, class-validator / class-transformer, mapped types, sérialisation des réponses, OpenAPI.
---

## DTO = classe

Un DTO (*Data Transfer Object*) décrit la forme des données entrantes. En NestJS c'est une **classe** (pas une interface) pour que les décorateurs de validation et les métadonnées existent au runtime.

```ts
import { IsEmail, IsEnum, IsInt, IsOptional, IsString, Length, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class AddressDto {
  @IsString() ville!: string;
}

export class CreateUserDto {
  @IsEmail() email!: string;
  @IsString() @Length(8, 72) password!: string;
  @IsInt() @Min(18) age!: number;
  @IsEnum(Role) @IsOptional() role?: Role;

  @ValidateNested() @Type(() => AddressDto)
  address!: AddressDto;
}
```

Pour un objet imbriqué, il faut **les deux** : `@ValidateNested()` (valider) et `@Type(() => Classe)` (instancier la bonne classe, sinon l'objet reste littéral et n'est pas validé).

## ValidationPipe

```ts
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,              // retire les propriétés sans décorateur
    forbidNonWhitelisted: true,   // ... ou renvoie 400 si présentes
    transform: true,              // instancie le DTO et convertit les types primitifs
    transformOptions: { enableImplicitConversion: true },
  }),
);
```

- Sans `whitelist`, un client peut envoyer `{ "email": "...", "isAdmin": true }` et, si le DTO est passé tel quel à l'ORM, faire de l'**assignation de masse** (*mass assignment*).
- Sans `transform`, le paramètre `@Body() dto: CreateUserDto` est un objet littéral (pas une instance), et `@Query('page') page: number` reste une **chaîne**.
- En cas d'échec : `400 Bad Request` avec un tableau de messages.

## Mapped types

```ts
import { PartialType, PickType, OmitType, IntersectionType } from '@nestjs/mapped-types'; // ou @nestjs/swagger

export class UpdateUserDto extends PartialType(CreateUserDto) {}
export class LoginDto extends PickType(CreateUserDto, ['email', 'password'] as const) {}
```

Contrairement à `Partial<T>` de TS, ces fonctions **conservent les décorateurs de validation** (et ajoutent `@IsOptional()` pour `PartialType`). Si tu utilises Swagger, importe-les depuis `@nestjs/swagger` pour garder aussi la doc.

## Sérialisation des réponses

```ts
export class UserEntity {
  id!: string;
  email!: string;
  @Exclude() password!: string;
  @Expose() get displayName() { return this.email.split('@')[0]; }
}

@UseInterceptors(ClassSerializerInterceptor)
@Get(':id')
async findOne(@Param('id') id: string) {
  return new UserEntity(await this.users.find(id));   // doit être une INSTANCE de la classe
}
```

`ClassSerializerInterceptor` applique `instanceToPlain` : il ne fonctionne que si on retourne une **instance** de la classe décorée, pas un objet brut issu de Prisma par exemple. Alternative explicite : mapper vers un DTO de réponse.

## Validation sans class-validator

Zod est une alternative de plus en plus courante (schémas partagés avec le front) :

```ts
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}
  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (!result.success) throw new BadRequestException(result.error.issues);
    return result.data;
  }
}
@Post() @UsePipes(new ZodValidationPipe(createUserSchema)) create(@Body() dto: CreateUserDto) {}
```

## OpenAPI / Swagger

```ts
const config = new DocumentBuilder().setTitle('API').addBearerAuth().build();
SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
```

Le **plugin CLI** de `@nestjs/swagger` (dans `nest-cli.json`) infère `@ApiProperty` à partir des types TypeScript et des commentaires : moins de duplication. Le document OpenAPI permet de **générer un client typé** pour le front (`openapi-typescript`, Orval).

<!-- QUIZ -->

### Pourquoi les DTO NestJS sont-ils des classes et non des interfaces ?
- [ ] Par convention uniquement
- [x] Les interfaces sont effacées : seules les classes portent au runtime les décorateurs de validation et les métadonnées de type
- [ ] Les interfaces ne peuvent pas avoir de propriétés optionnelles
- [ ] Les classes sont plus rapides à sérialiser
> Le `ValidationPipe` lit le type du paramètre (`design:paramtypes`) pour savoir quelle classe instancier puis valider avec class-validator. Avec une interface, la métadonnée est `Object` : aucune validation n'a lieu, silencieusement.
[doc]: NestJS — Validation (EN) | https://docs.nestjs.com/techniques/validation

### Quel est l'effet de `whitelist: true` ?
- [ ] Il n'autorise que certaines IP
- [x] Il retire du DTO toutes les propriétés qui n'ont aucun décorateur de validation
- [ ] Il rejette la requête si une propriété est inconnue
- [ ] Il rend toutes les propriétés optionnelles
> Protection contre l'assignation de masse : un champ `isAdmin` envoyé par le client disparaît s'il n'est pas déclaré dans le DTO. `forbidNonWhitelisted: true` va plus loin et renvoie une 400.
[doc]: NestJS — Stripping properties (EN) | https://docs.nestjs.com/techniques/validation#stripping-properties

### Sans `transform: true`, quel est le type réel de `page` ?
```ts
@Get()
list(@Query('page') page: number) {}
```
- [ ] `number`
- [x] `string` (ou `undefined`)
- [ ] `NaN`
- [ ] `unknown`
> Les query params sont toujours des chaînes en HTTP. L'annotation `number` ne convertit rien. Avec `transform: true` (+ type primitif dans la signature), le ValidationPipe convertit ; sinon utilise `ParseIntPipe`.
[doc]: NestJS — Transform payload objects (EN) | https://docs.nestjs.com/techniques/validation#transform-payload-objects

### Un DTO contient `address: AddressDto` décoré avec `@ValidateNested()` seulement. Pourquoi l'adresse n'est-elle pas validée ?
- [ ] `@ValidateNested` ne fonctionne qu'avec des tableaux
- [x] Il manque `@Type(() => AddressDto)` : sans lui, class-transformer ne crée pas d'instance d'`AddressDto` et ses décorateurs ne s'appliquent pas
- [ ] Il faut `@IsObject()` à la place
- [ ] La validation imbriquée est impossible
> class-validator valide les **instances** de classes. `@Type` indique à class-transformer quelle classe instancier pour la propriété imbriquée (les métadonnées de type ne suffisent pas pour les tableaux et les cas complexes).
[doc]: class-validator — Validating nested objects (EN) | https://github.com/typestack/class-validator#validating-nested-objects

### Quelle est la différence entre `PartialType(CreateUserDto)` de Nest et `Partial<CreateUserDto>` de TypeScript ?
- [ ] Aucune
- [x] `PartialType` crée une **classe** au runtime qui hérite des règles de validation (rendues optionnelles) ; `Partial<T>` n'est qu'un type, sans aucune validation
- [ ] `Partial<T>` est plus strict
- [ ] `PartialType` ne fonctionne qu'avec Swagger
> `class UpdateUserDto extends PartialType(CreateUserDto) {}` est une vraie classe validable. Les mapped types de `@nestjs/swagger` conservent en plus les métadonnées OpenAPI.
[doc]: NestJS — Mapped types (EN) | https://docs.nestjs.com/techniques/validation#mapped-types

### Que retourne Nest quand la validation d'un body échoue avec le `ValidationPipe` par défaut ?
- [ ] 422 Unprocessable Entity
- [x] 400 Bad Request avec un tableau de messages d'erreur
- [ ] 500 Internal Server Error
- [ ] 200 avec `errors` dans le body
> Le statut par défaut est 400. On peut le changer (`errorHttpStatusCode: 422`) ou formater les erreurs avec `exceptionFactory`.
[doc]: NestJS — Validation (EN) | https://docs.nestjs.com/techniques/validation

### `@Exclude()` est posé sur `password` mais le mot de passe apparaît dans la réponse. Le handler retourne `this.prisma.user.findUnique(...)`. Pourquoi ?
- [ ] `ClassSerializerInterceptor` ne fonctionne pas avec Prisma
- [x] Le handler retourne un objet brut, pas une instance de la classe décorée : le sérialiseur ne trouve aucune métadonnée `@Exclude`
- [ ] Il faut `@Exclude({ toPlainOnly: false })`
- [ ] `@Exclude` ne fonctionne que sur les getters
> `instanceToPlain` s'appuie sur les décorateurs de la **classe de l'instance**. Il faut retourner `new UserEntity(data)` ou `plainToInstance(UserEntity, data)`. Plus robuste encore : un `select` explicite qui ne lit jamais le mot de passe.
[doc]: NestJS — Serialization (EN) | https://docs.nestjs.com/techniques/serialization

### Quel est le principal risque de sécurité si l'on passe un body non filtré directement à `repository.save(body)` ?
- [ ] Injection SQL
- [x] Assignation de masse : le client peut modifier des champs non prévus (`role`, `isVerified`, `ownerId`…)
- [ ] XSS
- [ ] CSRF
> Défense : DTO stricts + `whitelist`/`forbidNonWhitelisted`, et mapper explicitement les champs autorisés vers l'entité. C'est l'item *Mass Assignment* de l'OWASP API Security Top 10 (API3:2023 — Broken Object Property Level Authorization).
[doc]: OWASP — Mass Assignment Cheat Sheet (EN) | https://cheatsheetseries.owasp.org/cheatsheets/Mass_Assignment_Cheat_Sheet.html

### Comment rendre une propriété de DTO optionnelle mais validée quand elle est présente ?
- [ ] `@IsDefined()`
- [x] `@IsOptional()` + les autres décorateurs (ex. `@IsString()`)
- [ ] `@Allow()`
- [ ] Ajouter `?` suffit
> Le `?` TypeScript est effacé : class-validator ne le voit pas. `@IsOptional()` ignore les autres validateurs si la valeur est `null` ou `undefined`.
[doc]: class-validator — Validation decorators (EN) | https://github.com/typestack/class-validator#validation-decorators

### Quel avantage apporte le plugin CLI de `@nestjs/swagger` ?
- [ ] Il génère les controllers
- [x] Il infère automatiquement `@ApiProperty` depuis les types TypeScript des DTO (et les commentaires), évitant la duplication
- [ ] Il valide les requêtes contre le schéma OpenAPI
- [ ] Il chiffre la documentation
> Le plugin s'exécute à la compilation (transformer TypeScript) et ajoute les métadonnées Swagger. Il peut aussi ajouter des validateurs avec l'option `classValidatorShim`.
[doc]: NestJS — OpenAPI CLI plugin (EN) | https://docs.nestjs.com/openapi/cli-plugin

### Comment le front peut-il profiter de la documentation OpenAPI générée par NestJS ?
- [ ] Il ne peut pas, c'est uniquement pour les humains
- [x] En générant un client et des types TypeScript à partir du document OpenAPI (openapi-typescript, Orval…)
- [ ] En important directement les DTO NestJS dans React
- [ ] En copiant les interfaces à la main
> Générer le client depuis le contrat garantit la cohérence front/back. Importer les DTO NestJS côté front est déconseillé : ils dépendent de class-validator / class-transformer et de `reflect-metadata`.
[doc]: NestJS — OpenAPI introduction (EN) | https://docs.nestjs.com/openapi/introduction

### Avec `transform: true`, que devient `dto` dans `create(@Body() dto: CreateUserDto)` ?
- [ ] Un objet littéral identique au JSON reçu
- [x] Une instance de `CreateUserDto` (on peut utiliser `instanceof` et ses méthodes)
- [ ] Une chaîne JSON
- [ ] Un `Partial<CreateUserDto>`
> `transform` applique `plainToInstance` avant de valider et transmet l'instance au handler. Sans lui, la validation a lieu sur une instance temporaire, mais le handler reçoit l'objet brut.
[doc]: NestJS — Transform payload objects (EN) | https://docs.nestjs.com/techniques/validation#transform-payload-objects

### Quelles options du `ValidationPipe` renforcent la sécurité des entrées ? (plusieurs réponses)
- [x] `whitelist: true`
- [x] `forbidNonWhitelisted: true`
- [ ] `disableErrorMessages: false`
- [ ] `skipMissingProperties: true`
> `whitelist` et `forbidNonWhitelisted` bloquent les champs non déclarés. `skipMissingProperties` affaiblit au contraire la validation (les propriétés absentes ne sont plus vérifiées). `disableErrorMessages: true` peut servir en prod pour ne pas divulguer la structure.
[doc]: NestJS — Validation options (EN) | https://docs.nestjs.com/techniques/validation#using-the-built-in-validationpipe
