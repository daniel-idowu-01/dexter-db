import { readFileSync } from "fs";
import { join } from "path";
import { SchemaModel, SchemaField, SchemaRelation } from "../types";
import { Logger } from "../utils/logger";

// Dynamic import of PrismaClient to handle cases where it hasn't been generated yet
function getPrismaClient(): any {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaClient } = require("@prisma/client");
    return PrismaClient;
  } catch (error) {
    throw new Error(
      "@prisma/client not found. Please run 'npm run prisma:generate' to generate the Prisma client."
    );
  }
}

export class PrismaParser {
  private schemaPath: string;
  private prisma: any;

  constructor(schemaPath?: string) {
    this.schemaPath = schemaPath || join(process.cwd(), "prisma", "schema.prisma");
    const PrismaClient = getPrismaClient();
    this.prisma = new PrismaClient();
  }


  async parseSchema(): Promise<SchemaModel[]> {
    try {
      const schemaContent = readFileSync(this.schemaPath, "utf-8");
      const models = this.extractModels(schemaContent);
      Logger.debug(`Parsed ${models.length} models from schema`);
      return models;
    } catch (error) {
      Logger.error(`Failed to parse Prisma schema: ${error}`);
      throw error;
    }
  }

  // Get database schema information using Prisma introspection
  async introspectDatabase(): Promise<SchemaModel[]> {
    try {
      const models = await this.parseSchema();
      
      // Enhance with actual database metadata if needed
      // This is a simplified version - in production, you might want to query
      // the database directly for more accurate type information
      
      return models;
    } catch (error) {
      Logger.error(`Failed to introspect database: ${error}`);
      throw error;
    }
  }

  private extractModels(schemaContent: string): SchemaModel[] {
    const models: SchemaModel[] = [];
    const modelRegex = /model\s+(\w+)\s*\{([^}]+)\}/g;
    let match;

    while ((match = modelRegex.exec(schemaContent)) !== null) {
      const modelName = match[1];
      const modelBody = match[2];
      
      const fields = this.extractFields(modelBody, modelName);
      const relations = this.extractRelations(modelBody, modelName);

      models.push({
        name: modelName,
        fields,
        relations,
      });
    }

    return models;
  }

  private extractFields(modelBody: string, modelName: string): SchemaField[] {
    const fields: SchemaField[] = [];
    const fieldRegex = /(\w+)\s+(\S+)(\s+.*?)?(?=\n|$)/g;
    let match;

    while ((match = fieldRegex.exec(modelBody)) !== null) {
      const fieldName = match[1];
      const fieldType = match[2];
      const attributes = match[3] || "";

      // Skip relation fields (they're handled separately)
      if (fieldType.includes("?") || fieldType.includes("[]")) {
        continue;
      }

      const isRequired = !fieldType.includes("?");
      const isUnique = attributes.includes("@unique");
      const isPrimaryKey = attributes.includes("@id");
      const isForeignKey = attributes.includes("@relation") || attributes.includes("ForeignKey");
      
      let defaultValue: any = undefined;
      const defaultMatch = attributes.match(/@default\(([^)]+)\)/);
      if (defaultMatch) {
        defaultValue = this.parseDefaultValue(defaultMatch[1]);
      }

      let enumValues: string[] | undefined = undefined;
      if (fieldType.startsWith("enum")) {
        enumValues = undefined;
      }

      let relationModel: string | undefined = undefined;
      let relationField: string | undefined = undefined;
      const relationMatch = attributes.match(/@relation\([^)]*fields:\s*\[([^\]]+)\][^)]*references:\s*\[([^\]]+)\][^)]*\)/);
      if (relationMatch) {
        relationField = relationMatch[2].trim();
      }

      fields.push({
        name: fieldName,
        type: this.normalizeType(fieldType),
        isRequired,
        isUnique,
        isPrimaryKey,
        isForeignKey,
        relationModel,
        relationField,
        defaultValue,
        enumValues,
      });
    }

    return fields;
  }

  private extractRelations(modelBody: string, modelName: string): SchemaRelation[] {
    const relations: SchemaRelation[] = [];
    const relationRegex = /(\w+)\s+(\w+)(\?|\[\])?\s+(@relation\([^)]+\))?/g;
    let match;

    while ((match = relationRegex.exec(modelBody)) !== null) {
      const fieldName = match[1];
      const relationModelName = match[2];
      const isOptional = match[3] === "?";
      const isArray = match[3] === "[]";
      const relationAttr = match[4] || "";

      let relationType: "oneToOne" | "oneToMany" | "manyToMany" = "oneToMany";
      if (isOptional && !isArray) {
        relationType = "oneToOne";
      } else if (isArray) {
        relationType = "manyToMany";
      }

      let foreignKey: string | undefined = undefined;
      const fkMatch = relationAttr.match(/fields:\s*\[([^\]]+)\]/);
      if (fkMatch) {
        foreignKey = fkMatch[1].trim();
      }

      relations.push({
        name: fieldName,
        type: relationType,
        model: relationModelName,
        field: fieldName,
        foreignKey,
      });
    }

    return relations;
  }

  // Normalize Prisma types to generic types
  private normalizeType(prismaType: string): string {
    const cleanType = prismaType.replace("?", "").replace("[]", "").trim();

    if (["String", "DateTime", "Json", "Bytes"].includes(cleanType)) {
      return "string";
    }

    if (["Int", "BigInt", "Float", "Decimal"].includes(cleanType)) {
      return "number";
    }

    if (cleanType === "Boolean") {
      return "boolean";
    }

    if (cleanType.startsWith("enum") || cleanType.match(/^[A-Z]/)) {
      return "enum";
    }

    return cleanType.toLowerCase();
  }

  private parseDefaultValue(value: string): any {
    const trimmed = value.trim();

    if (trimmed.startsWith('"') || trimmed.startsWith("'")) {
      return trimmed.slice(1, -1);
    }

    if (/^-?\d+$/.test(trimmed)) {
      return parseInt(trimmed, 10);
    }

    if (/^-?\d+\.\d+$/.test(trimmed)) {
      return parseFloat(trimmed);
    }

    if (trimmed === "true") return true;
    if (trimmed === "false") return false;

    if (trimmed.startsWith("now()")) return new Date();
    if (trimmed.startsWith("uuid()")) return undefined;

    return trimmed;
  }

  getPrismaClient(): any {
    return this.prisma;
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

